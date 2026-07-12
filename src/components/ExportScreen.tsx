/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertTriangle, ShieldAlert, X } from "lucide-react";
import { CoachClipProject, ExportStatus } from "../types";

interface ExportScreenProps {
  project: CoachClipProject;
  sourceFile: File | null;
  onExportSuccess: (exportResult: NonNullable<CoachClipProject["export"]>) => void;
  onExportFailed: (errorMsg?: string) => void;
}

export const ExportScreen: React.FC<ExportScreenProps> = ({
  project,
  sourceFile,
  onExportSuccess,
  onExportFailed,
}) => {
  const [status, setStatus] = useState<ExportStatus>("not_exported");
  const [stage, setStage] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showPrivacyConfirm, setShowPrivacyConfirm] = useState<boolean>(true);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentJobIdRef = useRef<string | null>(null);

  // Clean up timers/requests on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const startRealExport = async () => {
    setShowPrivacyConfirm(false);
    setStatus("uploading");
    setStage("Uploader video...");
    setProgress(0);

    try {
      let fileToUpload: File | Blob;

      if (sourceFile) {
        fileToUpload = sourceFile;
      } else {
        // Fallback: If stock/demo video is used, fetch it as a blob
        setStage("Henter demovideo...");
        const demoUrl = "https://assets.mixkit.co/videos/preview/mixkit-player-jumping-in-a-basketball-game-34283-large.mp4";
        const response = await fetch(demoUrl);
        const blob = await response.blob();
        fileToUpload = new File([blob], "Demo_Basketball_Video.mp4", { type: "video/mp4" });
        setStatus("uploading");
        setStage("Uploader video...");
      }

      // Compile ExportRequestMetadata
      const metadata = {
        projectId: project.id,
        clip: {
          startTime: project.clip.startTime,
          endTime: project.clip.endTime,
        },
        sourceVideo: {
          fileName: sourceFile?.name || "Demo_Basketball_Video.mp4",
          duration: project.sourceVideo.duration,
          width: project.sourceVideo.width,
          height: project.sourceVideo.height,
        },
        annotations: project.annotations,
        output: {
          maxWidth: 1920,
          maxHeight: 1080,
          format: "mp4",
        },
      };

      const formData = new FormData();
      formData.append("video", fileToUpload);
      formData.append("metadata", JSON.stringify(metadata));

      // Use XMLHttpRequest to report real upload progress & support abort
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            const jobId = response.jobId;
            currentJobIdRef.current = jobId;
            setStatus("queued");
            setStage("Sat i kø...");
            startPolling(jobId);
          } catch (e) {
            handleFailure("Kunne ikke behandle serverens svar.");
          }
        } else {
          try {
            const errRes = JSON.parse(xhr.responseText);
            handleFailure(errRes.message || `Upload fejlede med status ${xhr.status}`);
          } catch (e) {
            handleFailure(`Upload fejlede med status ${xhr.status}`);
          }
        }
      });

      xhr.addEventListener("error", () => {
        handleFailure("CoachClip kunne ikke kontakte eksportserveren. Kontrollér din forbindelse, og prøv igen.");
      });

      xhr.addEventListener("abort", () => {
        setStatus("cancelled");
      });

      xhr.open("POST", "/api/exports");
      xhr.send(formData);
    } catch (err: any) {
      handleFailure("Der opstod en uventet fejl under upload.");
    }
  };

  const startPolling = (jobId: string) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    pollTimerRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/exports/${jobId}`);
        if (!response.ok) {
          throw new Error(`Server status ${response.status}`);
        }
        const job = await response.json();

        // Update local status & progress
        setStatus(job.status);
        setProgress(job.progress || 0);

        // Map stage to beautiful Danish subtitles
        if (job.stage === "validating") {
          setStage("Kontrollerer video...");
        } else if (job.stage === "trimming") {
          setStage("Klipper situation...");
        } else if (job.stage === "rendering_annotations") {
          setStage("Tilføjer markeringer...");
        } else if (job.stage === "rendering_freezes") {
          setStage("Tilføjer frysebillede...");
        } else if (job.stage === "encoding") {
          setStage("Opretter MP4...");
        } else if (job.stage === "finalizing") {
          setStage("Gør klar...");
        } else if (job.status === "processing") {
          setStage("Behandler video...");
        }

        if (job.status === "completed" && job.output) {
          clearInterval(pollTimerRef.current!);
          onExportSuccess({
            jobId,
            status: "exported",
            fileName: job.output.fileName,
            fileSize: job.output.size,
            duration: job.output.duration,
            downloadUrl: job.output.downloadUrl,
            expiresAt: job.output.expiresAt,
          });
        } else if (job.status === "failed") {
          clearInterval(pollTimerRef.current!);
          handleFailure(job.userMessage || "Klippet kunne ikke oprettes. Projektet og dine markeringer er stadig gemt.");
        } else if (job.status === "cancelled") {
          clearInterval(pollTimerRef.current!);
          setStatus("cancelled");
        }
      } catch (err) {
        // Tolerates brief connection drops, but if persistent, alert
        console.error("Polling error:", err);
      }
    }, 1200);
  };

  const handleFailure = (msg: string) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }
    setErrorMsg(msg);
    setStatus("failed");
  };

  const handleCancel = async () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    const jobId = currentJobIdRef.current;
    if (jobId) {
      try {
        await fetch(`/api/exports/${jobId}`, { method: "DELETE" });
      } catch (e) {
        console.error("Failed to cancel job on server:", e);
      }
    }

    onExportFailed("Eksporten blev afbrudt.");
  };

  // Privacy Confirmation Dialog (Section 9!)
  if (showPrivacyConfirm) {
    return (
      <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 animate-scale-up text-center">
        <div className="w-16 h-16 bg-blue-50 text-brand-clear rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-brand-dark mb-3">Beskyttelse af dine videoer</h3>
        
        <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
          Videoen sendes midlertidigt til CoachClip for at oprette dit klip. Videoen og den færdige fil slettes automatisk efter behandlingen. Vi gemmer ikke dine data permanent.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={startRealExport}
            className="w-full py-3.5 bg-brand-clear hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow cursor-pointer transition-all"
          >
            Fortsæt og eksporter
          </button>
          <button
            onClick={() => onExportFailed("Afbrudt af bruger.")}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
          >
            Gå tilbage
          </button>
        </div>
      </div>
    );
  }

  // Failure display
  if (status === "failed") {
    return (
      <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 text-center animate-scale-up">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">Eksporten fejlede</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">
          {errorMsg || "Klippet kunne ikke oprettes. Projektet og dine markeringer er stadig gemt."}
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={() => onExportFailed(errorMsg)}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
          >
            Gå tilbage
          </button>
          <button
            onClick={startRealExport}
            className="flex-1 py-3 bg-brand-clear hover:bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-all"
          >
            Prøv igen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center animate-scale-up">
      {/* Visual Loader */}
      <div className="relative w-24 h-24 mb-6">
        {status !== "exported" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-16 h-16 text-brand-clear animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-brand-success animate-bounce">
            <CheckCircle2 className="w-16 h-16" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-slate-700">
          {progress}%
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-black text-brand-dark mb-1 text-center">
        {status === "uploading" ? "Uploader video..." : "Opretter dit taktikklip"}
      </h3>
      
      {/* Live Stage Subtitle */}
      <p className="text-xs text-brand-clear font-bold tracking-wider uppercase mb-8 text-center animate-pulse">
        {stage}
      </p>

      {/* Progress slider bar */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-brand-clear transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Explanatory text */}
      <p className="text-[10px] text-slate-400 font-medium text-center mb-6 leading-relaxed max-w-xs">
        {status === "uploading"
          ? "Uploader din spilsekvens til CoachClip serveren. Dette kan tage et øjeblik afhængigt af din internetforbindelse."
          : "Serveren klipper din video og brænder alle cirkler, pile og frysepunkter ind i det færdige klip."}
      </p>

      {/* Cancel button */}
      <button
        onClick={handleCancel}
        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-all"
      >
        <X className="w-3.5 h-3.5" />
        <span>Afbryd eksport</span>
      </button>
    </div>
  );
};
