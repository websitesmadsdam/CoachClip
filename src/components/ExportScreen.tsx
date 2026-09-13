/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { CoachClipProject } from "../types";
import { exportClip, EXPORT_STAGE_LABELS, type ExportedClip, type ExportProgress } from "../export/exportClip";
import { ExportError, EXPORT_ERROR_MESSAGES } from "../export/exportErrors";
import { detectExportCapabilities } from "../export/capabilities";
import { clearExportFiles } from "../export/exportStorage";

const MISSING_SOURCE_MESSAGE = "Kildevideoen blev ikke fundet. Vælg eller genforbind din videofil for at eksportere.";

type ScreenState =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "running"; progress: ExportProgress }
  | { kind: "failed"; message: string }
  | { kind: "cancelled" };

interface ExportScreenProps {
  project: CoachClipProject;
  sourceFile: File | null;
  onExportSuccess: (clip: ExportedClip) => void;
  onExportFailed: () => void;
}

function stageText(progress: ExportProgress): string {
  const label = EXPORT_STAGE_LABELS[progress.stage];
  return progress.stage === "rendering" ? `${label} ${Math.round(progress.fraction * 100)} %` : label;
}

export const ExportScreen: React.FC<ExportScreenProps> = ({ project, sourceFile, onExportSuccess, onExportFailed }) => {
  const [state, setState] = useState<ScreenState>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    let active = true;
    const update = (next: ScreenState) => {
      if (active) setState(next);
    };

    (async () => {
      if (!sourceFile || sourceFile.size === 0) {
        update({ kind: "failed", message: MISSING_SOURCE_MESSAGE });
        return;
      }
      update({ kind: "checking" });
      const capabilities = await detectExportCapabilities();
      if (!active) return;
      if (!capabilities.supported) {
        update({ kind: "unsupported" });
        return;
      }
      // The coach may already have pressed "Afbryd eksport" while the browser was being checked
      if (controller.signal.aborted) {
        update({ kind: "cancelled" });
        return;
      }
      update({ kind: "running", progress: { stage: "preparing", fraction: 0 } });
      await clearExportFiles();
      try {
        const clip = await exportClip({
          file: sourceFile,
          project,
          signal: controller.signal,
          onProgress: (progress) => update({ kind: "running", progress }),
        });
        if (active) onExportSuccess(clip);
      } catch (error) {
        const exportError = error instanceof ExportError ? error : new ExportError("UNKNOWN", { cause: error });
        update(exportError.code === "CANCELLED" ? { kind: "cancelled" } : { kind: "failed", message: exportError.message });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
    // The project and source file are fixed while this screen is shown; "Prøv igen" bumps `attempt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state.kind === "unsupported") {
    return (
      <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 text-center animate-scale-up">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">Browseren kan ikke lave klip</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">{EXPORT_ERROR_MESSAGES.UNSUPPORTED_BROWSER}</p>
        <button
          onClick={() => onExportFailed()}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
        >
          Gå tilbage
        </button>
      </div>
    );
  }

  if (state.kind === "failed" || state.kind === "cancelled") {
    const isCancelled = state.kind === "cancelled";
    // A missing source file cannot be fixed by retrying the same export attempt.
    const isMissingSource = state.kind === "failed" && state.message === MISSING_SOURCE_MESSAGE;
    return (
      <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 text-center animate-scale-up">
        {isCancelled ? (
          <div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <X className="w-8 h-8" />
          </div>
        ) : (
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="w-8 h-8" />
          </div>
        )}
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">
          {isCancelled ? "Eksporten blev afbrudt" : "Eksporten fejlede"}
        </h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">
          {state.kind === "cancelled" ? "Du afbrød eksporten. Projektet og dine markeringer er stadig gemt." : state.message}
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={() => onExportFailed()}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
          >
            Gå tilbage
          </button>
          {!isMissingSource && (
            <button
              onClick={() => setAttempt((value) => value + 1)}
              className="flex-1 py-3 bg-brand-clear hover:bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-all"
            >
              Prøv igen
            </button>
          )}
        </div>
      </div>
    );
  }

  const progress = state.kind === "running" ? state.progress : null;
  const percent = progress ? Math.round(progress.fraction * 100) : 0;

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center animate-scale-up">
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-16 h-16 text-brand-clear animate-spin" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-slate-700">
          {percent}%
        </div>
      </div>

      <h3 className="text-lg font-black text-brand-dark mb-1 text-center">Opretter dit taktikklip</h3>

      <p className="text-xs text-brand-clear font-bold tracking-wider uppercase mb-8 text-center animate-pulse">
        {progress ? stageText(progress) : EXPORT_STAGE_LABELS.preparing}
      </p>

      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-brand-clear transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>

      <p className="text-[10px] text-slate-400 font-medium text-center mb-6 leading-relaxed max-w-xs">
        Klippet laves på din enhed – videoen sendes ingen steder. Hold skærmen tændt, til klippet er færdigt.
      </p>

      <button
        onClick={() => controllerRef.current?.abort()}
        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-all"
      >
        <X className="w-3.5 h-3.5" />
        <span>Afbryd eksport</span>
      </button>
    </div>
  );
};
