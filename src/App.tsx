/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Share2, Download, AlertTriangle, X, CheckCircle2, PlusCircle
} from "lucide-react";
import { CoachClipProject, Collection, Annotation } from "./types";
import { dbService } from "./db";
import { Sidebar } from "./components/Sidebar";
import { BottomNav } from "./components/BottomNav";
import { CoachClipLogo } from "./components/CoachClipLogo";
import { UserGuide } from "./components/UserGuide";

// Screen Views
import { HomeScreen } from "./screens/HomeScreen";
import { VideoSelectScreen } from "./screens/VideoSelectScreen";
import { ClipSelectScreen } from "./screens/ClipSelectScreen";
import { ClipFineTuneScreen } from "./screens/ClipFineTuneScreen";
import { AnnotationEditor } from "./features/annotations/AnnotationEditor";
import { AnnotationCanvas } from "./features/annotations/AnnotationCanvas";
import { PreviewScreen } from "./screens/PreviewScreen";
import { SaveProjectScreen } from "./screens/SaveProjectScreen";
import { ProjectLibraryScreen } from "./screens/ProjectLibraryScreen";
import { ExportScreen } from "./components/ExportScreen";
import { CollectionsScreen } from "./components/CollectionsScreen";
import { useObjectUrl } from "./hooks/useObjectUrl";
import type { ExportedClip } from "./export/exportClip";
import { deliverClip } from "./export/deliverClip";
import { clearExportFiles } from "./export/exportStorage";
import { AUDIO_WARNING_MESSAGE } from "./export/exportErrors";
import { hasMatchingSource } from "./utils/projectStatus";
import { getVideoStageStyle } from "./utils/videoUtils";

// Flag to toggle seeding of demo data
const ENABLE_DEMO_DATA = false;

export default function App() {
  // Current tab: "home" | "projects" | "collections" | "settings"
  const [currentTab, setCurrentTab] = useState<string>("home");
  const [settingsSubTab, setSettingsSubTab] = useState<"guide" | "system">("guide");

  // Core Projects & Collections State
  const [projects, setProjects] = useState<CoachClipProject[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Video Editing Pipeline State:
  // "idle" | "choose" | "trim" | "adjust" | "editor" | "review" | "save" | "exporting" | "success"
  const [editorStep, setEditorStep] = useState<"idle" | "choose" | "trim" | "adjust" | "editor" | "review" | "save" | "exporting" | "success">("idle");
  
  // Selected video details
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileUrl = useObjectUrl(selectedFile);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width?: number; height?: number }>({});

  useEffect(() => {
    if (fileUrl) {
      setVideoUrl(fileUrl);
    }
  }, [fileUrl]);

  // Active Project being edited/created
  const [activeProject, setActiveProject] = useState<CoachClipProject | null>(null);
  const [trimRange, setTrimRange] = useState<{ startTime: number; endTime: number }>({ startTime: 0, endTime: 0 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // State for restoring project with missing video file
  const [projectToRestore, setProjectToRestore] = useState<CoachClipProject | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // Action Modals State
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [previewProject, setPreviewProject] = useState<CoachClipProject | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [reviewVideoSize, setReviewVideoSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // The finished clip lives only in memory/OPFS while the success screen is shown
  const [exportedClip, setExportedClip] = useState<ExportedClip | null>(null);
  const [restoreIntent, setRestoreIntent] = useState<"edit" | "preview">("edit");
  const previousStepRef = useRef(editorStep);

  // Leftover export files from an earlier visit are never needed again
  useEffect(() => {
    void clearExportFiles();
  }, []);

  // Leaving the success screen discards the clip file; a new export creates a fresh one
  useEffect(() => {
    if (previousStepRef.current === "success" && editorStep !== "success") {
      setExportedClip(null);
      void clearExportFiles();
    }
    previousStepRef.current = editorStep;
  }, [editorStep]);

  // Load projects from DB and Seed Demo data if empty
  const loadProjectsData = async () => {
    try {
      const allProjects = await dbService.getAllProjects();
      const allCollections = await dbService.getAllCollections();
      
      if (ENABLE_DEMO_DATA && allProjects.length === 0) {
        const seed1: CoachClipProject = {
          id: "mock_1",
          title: "Hurtigt kontraangreb - Håndbold",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          sourceVideo: {
            fileName: "kontraloeb_em_2026.mp4",
            duration: 15,
            size: 4500000,
          },
          clip: {
            startTime: 2,
            endTime: 9,
          },
          annotations: [
            {
              id: "anno_mock_1",
              type: "text",
              startTime: 2,
              endTime: 6,
              text: "Læg mærke til venstre fløj der starter løbet tidligt!",
              x: 0.5,
              y: 0.82,
              size: "normal"
            },
            {
              id: "anno_mock_2",
              type: "circle",
              startTime: 3,
              endTime: 7,
              x: 0.35,
              y: 0.45,
              radius: 0.08,
              color: "yellow",
              thickness: "bold"
            }
          ],
          category: "Kontra",
          feedbackType: "positive",
          exportStatus: "exported"
        };

        const seed2: CoachClipProject = {
          id: "mock_2",
          title: "Opdækning ved screening - Basketball",
          createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          sourceVideo: {
            fileName: "defense_screening_3.mov",
            duration: 20,
            size: 8900000,
          },
          clip: {
            startTime: 5,
            endTime: 12,
          },
          annotations: [
            {
              id: "anno_mock_3",
              type: "arrow",
              startTime: 6,
              endTime: 10,
              startX: 0.6,
              startY: 0.5,
              endX: 0.42,
              endY: 0.48,
              color: "red"
            },
            {
              id: "anno_mock_4",
              type: "text",
              startTime: 6,
              endTime: 10,
              text: "Vi skal skifte hurtigere her!",
              x: 0.5,
              y: 0.15,
              size: "normal"
            }
          ],
          category: "Forsvar",
          feedbackType: "development",
          exportStatus: "not_exported"
        };

        await dbService.saveProject(seed1);
        await dbService.saveProject(seed2);

        // Seed an initial collection
        const mockCol: Collection = {
          id: "col_mock_1",
          title: "Taktik til næste holdsportmøde",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          projectIds: ["mock_1"]
        };
        await dbService.saveCollection(mockCol);

        const refreshedProjects = await dbService.getAllProjects();
        const refreshedCollections = await dbService.getAllCollections();
        setProjects(refreshedProjects);
        setCollections(refreshedCollections);
      } else {
        setProjects(allProjects);
        setCollections(allCollections);
      }
    } catch (e) {
      console.error("Failed to initialize CoachClipDB:", e);
    }
  };

  useEffect(() => {
    loadProjectsData();
  }, []);

  // Set video source safely
  const setVideoSourceSafely = (url: string) => {
    setVideoUrl(url);
  };

  // Handle the picked video file
  const handleVideoFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      alert("Videoformatet understøttes ikke endnu. Vælg en MP4- eller MOV-video.");
      return;
    }

    setSelectedFile(file);
    setEditorStep("choose");

    // Retrieve video file metadata dynamically
    const tempVideo = document.createElement("video");
    const tempObjUrl = URL.createObjectURL(file);
    tempVideo.src = tempObjUrl;
    tempVideo.onloadedmetadata = () => {
      setVideoDuration(tempVideo.duration);
      setVideoDimensions({
        width: tempVideo.videoWidth,
        height: tempVideo.videoHeight
      });
      URL.revokeObjectURL(tempObjUrl);
    };
  };

  // Restoring a project: videos are never stored, so the coach picks the source file again
  const handleRestoreVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !projectToRestore) return;
    setSelectedFile(file);
    setVideoDuration(projectToRestore.sourceVideo.duration);
    setProjectToRestore(null);
    if (restoreIntent === "preview") {
      setPreviewProject(projectToRestore);
      setPreviewCurrentTime(projectToRestore.clip.startTime);
      return;
    }
    setTrimRange(projectToRestore.clip);
    setAnnotations(projectToRestore.annotations);
    setActiveProject(projectToRestore);
    setEditorStep("editor");
  };

  const selectProjectForEditing = (proj: CoachClipProject) => {
    // Reuse the file picked in this session when it is the project's source; otherwise ask for it
    if (!hasMatchingSource(selectedFile, proj)) {
      setRestoreIntent("edit");
      setProjectToRestore(proj);
      return;
    }
    setVideoDuration(proj.sourceVideo.duration);
    setTrimRange(proj.clip);
    setAnnotations(proj.annotations);
    setActiveProject(proj);
    setEditorStep("editor");
  };

  // Pipeline navigation actions
  const handleNewClipTrigger = () => {
    setSelectedFile(null);
    setVideoSourceSafely("");
    setActiveProject(null);
    setEditorStep("choose");
  };

  const acceptVideoChoice = () => {
    if (!selectedFile) return;

    // Build temporary working draft project
    const newProj: CoachClipProject = {
      id: "proj_" + Date.now(),
      title: "Uden titel",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceVideo: {
        fileName: selectedFile.name,
        duration: videoDuration,
        size: selectedFile.size,
        width: videoDimensions.width,
        height: videoDimensions.height
      },
      clip: {
        startTime: 0,
        endTime: videoDuration
      },
      annotations: [],
      exportStatus: "not_exported"
    };

    setActiveProject(newProj);
    setTrimRange({ startTime: 0, endTime: videoDuration });
    setEditorStep("trim");
  };

  const handleTrimComplete = (start: number, end: number) => {
    setTrimRange({ startTime: start, endTime: end });
    setEditorStep("adjust");
  };

  const handleAdjustComplete = (start: number, end: number) => {
    setTrimRange({ startTime: start, endTime: end });
    setEditorStep("editor");
  };

  const handleAnnotationsComplete = (annos: Annotation[]) => {
    setAnnotations(annos);
    setEditorStep("review");
  };

  // Form selections and inline saving
  const handleSaveAndProcess = async (data: {
    title: string;
    feedbackType: "positive" | "development";
    category: string;
    collectionId: string;
    newCollectionTitle?: string;
  }, exportNow: boolean) => {
    if (!activeProject) return;

    let finalCollectionId = data.collectionId === "none" ? undefined : data.collectionId;

    // Creating new inline collection
    if (data.newCollectionTitle) {
      const colId = "col_" + Date.now();
      const newCol: Collection = {
        id: colId,
        title: data.newCollectionTitle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectIds: [activeProject.id]
      };
      await dbService.saveCollection(newCol);
      finalCollectionId = colId;
    }

    const updatedProj: CoachClipProject = {
      ...activeProject,
      title: data.title,
      clip: trimRange,
      annotations: annotations,
      feedbackType: data.feedbackType,
      category: data.category,
      collectionId: finalCollectionId,
      // Saved changes make any earlier export outdated
      exportStatus: "not_exported",
      export: undefined,
      updatedAt: new Date().toISOString()
    };

    await dbService.saveProject(updatedProj);
    setActiveProject(updatedProj);

    // Update existing collection associations
    if (finalCollectionId && !data.newCollectionTitle) {
      const col = collections.find(c => c.id === finalCollectionId);
      if (col && !col.projectIds.includes(activeProject.id)) {
        const upCol = {
          ...col,
          projectIds: [...col.projectIds, activeProject.id],
          updatedAt: new Date().toISOString()
        };
        await dbService.saveCollection(upCol);
      }
    }

    await loadProjectsData();

    if (exportNow) {
      setEditorStep("exporting");
    } else {
      setEditorStep("idle");
      setCurrentTab("projects");
    }
  };

  const handleExportSuccess = async (clip: ExportedClip) => {
    if (!activeProject) return;

    const finished: CoachClipProject = {
      ...activeProject,
      exportStatus: "exported",
      export: {
        status: "exported",
        fileName: clip.fileName,
        fileSize: clip.sizeBytes,
        duration: clip.durationSec,
        width: clip.width,
        height: clip.height,
        exportedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      await dbService.saveProject(finished);
      await loadProjectsData();
    } catch (error) {
      console.error("Failed to save the finished export to the project database:", error);
    }

    // The clip file is what matters; the "Eksporteret" badge is cosmetic and can lag.
    setActiveProject(finished);
    setExportedClip(clip);
    setEditorStep("success");
  };

  const handleDeliver = async (mode: "share" | "download") => {
    if (!exportedClip) return;
    try {
      await deliverClip(exportedClip, mode);
    } catch (error) {
      console.error("Delivering the clip failed:", error);
      alert("Klippet kunne ikke deles eller gemmes. Prøv igen.");
    }
  };

  // Project cards action helper
  const duplicateProject = async (proj: CoachClipProject) => {
    const dupe: CoachClipProject = {
      ...proj,
      id: "proj_dupe_" + Date.now(),
      title: `${proj.title} (Kopi)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dbService.saveProject(dupe);
    await loadProjectsData();
  };

  const deleteProject = async (id: string) => {
    if (confirm("Er du sikker på, du vil slette dette analyseklip permanent?")) {
      await dbService.deleteProject(id);
      
      // Clean up dead project reference from any collections containing it
      const allCollections = await dbService.getAllCollections();
      for (const col of allCollections) {
        if (col.projectIds.includes(id)) {
          const updatedCol = {
            ...col,
            projectIds: col.projectIds.filter(pId => pId !== id),
            updatedAt: new Date().toISOString()
          };
          await dbService.saveCollection(updatedCol);
        }
      }

      await loadProjectsData();
    }
  };

  const openRenameModal = (id: string, currentTitle: string) => {
    setRenameProjectId(id);
    setRenameValue(currentTitle);
  };

  const saveRename = async () => {
    if (!renameProjectId || !renameValue.trim()) return;
    const proj = projects.find(p => p.id === renameProjectId);
    if (proj) {
      const updated = { ...proj, title: renameValue, updatedAt: new Date().toISOString() };
      await dbService.saveProject(updated);
      await loadProjectsData();
    }
    setRenameProjectId(null);
  };

  const openPreview = (proj: CoachClipProject) => {
    if (!hasMatchingSource(selectedFile, proj)) {
      setRestoreIntent("preview");
      setProjectToRestore(proj);
      return;
    }
    setPreviewProject(proj);
    setPreviewCurrentTime(proj.clip.startTime);
  };

  const isEditingVideo = ["choose", "trim", "adjust", "editor", "review", "save", "exporting", "success"].includes(editorStep);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 select-none">
      
      {/* Mobile Top Header Bar with Top-Left Icon */}
      {!isEditingVideo && (
        <header className="md:hidden bg-brand-dark text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentTab("home")}>
            <CoachClipLogo className="w-8 h-8" size={32} />
            <div>
              <span className="font-sans font-black text-base tracking-tight text-white leading-none block">CoachClip</span>
              <span className="text-[9px] text-brand-accent font-semibold uppercase tracking-wider block">Videoanalyse</span>
            </div>
          </div>
          <button
            onClick={handleNewClipTrigger}
            className="bg-brand-clear hover:bg-blue-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nyt klip</span>
          </button>
        </header>
      )}

      {/* Sidebar Desktop Nav (Hidden when editing video to give editor stage maximum space) */}
      {!isEditingVideo && (
        <Sidebar 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab} 
          onNewClip={handleNewClipTrigger} 
        />
      )}

      {/* Main Container */}
      <main className={`flex-1 flex flex-col min-h-screen overflow-y-auto ${!isEditingVideo ? "pb-20 md:pb-6 p-4 md:p-8" : "p-2 sm:p-6"}`}>
        
        {isEditingVideo ? (
          <div className="flex-1 flex flex-col justify-center items-center h-full">
            
            {/* Screen 2: Choose Video */}
            {editorStep === "choose" && (
              <VideoSelectScreen
                selectedFile={selectedFile}
                onFileSelected={handleVideoFile}
                onBack={() => setEditorStep("idle")}
                onAccept={acceptVideoChoice}
              />
            )}

            {/* Screen 3: Trim General Range */}
            {editorStep === "trim" && (
              <ClipSelectScreen
                videoUrl={videoUrl}
                fileName={selectedFile?.name || "Råvideo.mp4"}
                fileSize={selectedFile?.size || 12000000}
                videoDuration={videoDuration}
                initialStartTime={trimRange.startTime}
                initialEndTime={trimRange.endTime}
                onBack={() => setEditorStep("choose")}
                onProceed={handleTrimComplete}
              />
            )}

            {/* Screen 4: Fine Tune Loop Mode */}
            {editorStep === "adjust" && (
              <ClipFineTuneScreen
                videoUrl={videoUrl}
                videoDuration={videoDuration}
                initialStartTime={trimRange.startTime}
                initialEndTime={trimRange.endTime}
                onBack={() => setEditorStep("trim")}
                onProceed={handleAdjustComplete}
              />
            )}

            {/* Screen 5: Draw and Annotate (Modular Annotation Editor Orchestration) */}
            {editorStep === "editor" && (
              <AnnotationEditor
                videoUrl={videoUrl}
                startTime={trimRange.startTime}
                endTime={trimRange.endTime}
                initialAnnotations={annotations}
                onBack={() => setEditorStep("adjust")}
                onComplete={handleAnnotationsComplete}
              />
            )}

            {/* Screen 6: Review finished clip before saving */}
            {editorStep === "review" && (
              <div className="w-full max-w-4xl mx-auto flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-scale-up">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="font-extrabold text-brand-dark text-lg">Gennemse dit klip</h3>
                    <p className="text-xs text-slate-500">Se det færdige analyseklip igennem med start, slut og markeringer.</p>
                  </div>
                  <span className="bg-brand-success/15 text-brand-success text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Klar til godkendelse
                  </span>
                </div>

                {/* Overlays preview area, shaped like the video */}
                <div className="w-full bg-black flex justify-center">
                <div
                  className="relative bg-black flex items-center justify-center"
                  style={getVideoStageStyle(reviewVideoSize.width, reviewVideoSize.height, "60svh")}
                >
                  <video
                    ref={previewVideoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain pointer-events-none"
                    onLoadedMetadata={(e) => setReviewVideoSize({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight })}
                    onTimeUpdate={() => {
                      const v = previewVideoRef.current;
                      if (!v) return;
                      setPreviewCurrentTime(v.currentTime);
                      if (v.currentTime >= trimRange.endTime) {
                        v.currentTime = trimRange.startTime;
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                  />

                  <AnnotationCanvas videoRef={previewVideoRef} annotations={annotations} time={previewCurrentTime} zIndexClassName="z-20" />
                </div>
                </div>

                <div className="p-6 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Er klippet klar til at blive gemt?</span>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setEditorStep("trim")}
                      className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Ret start/slut
                    </button>
                    <button
                      onClick={() => setEditorStep("editor")}
                      className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Ret markeringer
                    </button>
                    <button
                      onClick={() => setEditorStep("save")}
                      className="px-6 py-2.5 bg-brand-clear hover:bg-blue-600 text-white text-xs font-black uppercase rounded-xl shadow cursor-pointer active:scale-95 transition-all"
                    >
                      Ja, gem klip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Screen 7: Save project settings */}
            {editorStep === "save" && (
              <SaveProjectScreen
                initialTitle={activeProject?.title || ""}
                initialFeedbackType={activeProject?.feedbackType || "positive"}
                initialCategory={activeProject?.category || "Angreb"}
                initialCollectionId={activeProject?.collectionId || "none"}
                collections={collections}
                onBack={() => setEditorStep("review")}
                onSave={(data) => {
                  const exportNow = true; // Default to export pipeline
                  handleSaveAndProcess(data, exportNow);
                }}
              />
            )}

            {/* Screen 8: Export in the browser */}
            {editorStep === "exporting" && activeProject && (
              <ExportScreen
                project={activeProject}
                sourceFile={selectedFile}
                onExportSuccess={handleExportSuccess}
                onExportFailed={() => setEditorStep("save")}
              />
            )}

            {/* Screen 9: Success & Share Options */}
            {editorStep === "success" && activeProject && exportedClip && (
              <div className="w-full max-w-md mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm text-center animate-scale-up">
                <div className="w-16 h-16 bg-green-50 text-brand-success rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="text-xl font-black text-brand-dark mb-1">Dit klip er klar!</h3>
                <p className="text-xs text-slate-400 font-medium mb-6">Klippet er lavet på din enhed. Del det med holdet, eller gem det som MP4.</p>

                {/* Details card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6 flex flex-col gap-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Klippets titel:</span>
                    <span className="text-slate-800 font-extrabold max-w-[200px] truncate">{activeProject.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Varighed:</span>
                    <span className="text-slate-800 font-extrabold">{exportedClip.durationSec.toFixed(1).replace(".", ",")} sekunder</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Format / Opløsning:</span>
                    <span className="text-slate-800 font-extrabold">MP4 / {exportedClip.width}×{exportedClip.height}</span>
                  </div>
                  {exportedClip.audioWarning && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 font-semibold">
                      {AUDIO_WARNING_MESSAGE}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => handleDeliver("share")}
                    className="w-full py-3.5 bg-brand-clear hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-brand-clear/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <Share2 className="w-4.5 h-4.5" />
                    <span>Del klip</span>
                  </button>

                  <button
                    onClick={() => handleDeliver("download")}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-850 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <Download className="w-4.5 h-4.5" />
                    <span>Download MP4</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => setEditorStep("editor")}
                      className="py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Rediger igen
                    </button>
                    <button
                      onClick={() => {
                        setTrimRange({ startTime: 0, endTime: videoDuration });
                        setAnnotations([]);
                        setEditorStep("trim");
                      }}
                      className="py-2.5 bg-brand-dark hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Nyt klip fra video
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setEditorStep("idle");
                      setCurrentTab("projects");
                    }}
                    className="text-xs text-brand-clear font-bold mt-4 hover:underline cursor-pointer"
                  >
                    Gå til Mine projekter
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : (
          /* STANDARD TABS CONTROL VIEWPORT */
          <div className="flex-1">
            
            {/* Tab 1: Home page */}
            {currentTab === "home" && (
              <HomeScreen
                projects={projects}
                onNewClip={handleNewClipTrigger}
                onSelectProject={selectProjectForEditing}
                onOpenPreview={openPreview}
                onDeleteProject={deleteProject}
                onViewAllProjects={() => setCurrentTab("projects")}
              />
            )}

            {/* Tab 2: Mine projekter list page */}
            {currentTab === "projects" && (
              <ProjectLibraryScreen
                projects={projects}
                onSelectProject={selectProjectForEditing}
                onOpenPreview={openPreview}
                onDeleteProject={deleteProject}
                onDuplicateProject={duplicateProject}
                onOpenRenameModal={openRenameModal}
                onNewClip={handleNewClipTrigger}
              />
            )}

            {/* Tab 3: Collections tab */}
            {currentTab === "collections" && (
              <CollectionsScreen
                projects={projects}
                onBackToHome={() => setCurrentTab("home")}
                onProjectsUpdate={loadProjectsData}
              />
            )}

            {/* Tab 4: Settings & User Guide page */}
            {currentTab === "settings" && (
              <div className="w-full max-w-4xl flex flex-col gap-6 animate-scale-up">
                {/* Sub-nav header inside Settings */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-brand-dark mb-1">Indstillinger & Vejledning</h3>
                    <p className="text-xs text-slate-400 font-medium">Find komplette guides, lager-information og administrer dine app-data.</p>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold shrink-0">
                    <button
                      onClick={() => setSettingsSubTab("guide")}
                      className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                        settingsSubTab === "guide"
                          ? "bg-white text-brand-clear shadow-sm font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Brugervejledning & Lager
                    </button>
                    <button
                      onClick={() => setSettingsSubTab("system")}
                      className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                        settingsSubTab === "system"
                          ? "bg-white text-brand-clear shadow-sm font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      System & Data
                    </button>
                  </div>
                </div>

                {settingsSubTab === "guide" ? (
                  <UserGuide />
                ) : (
                  <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <h4 className="text-lg font-black text-brand-dark mb-1">System & Lokallager</h4>
                    <p className="text-xs text-slate-400 mb-6 font-medium">Teknisk status og nulstilling af din enheds lokale database.</p>

                    <div className="flex flex-col gap-6">
                      <div className="border-b border-slate-100 pb-5">
                        <h4 className="text-sm font-bold text-slate-800 mb-1">Sprog</h4>
                        <p className="text-xs text-slate-500">CoachClip er fuldt lokaliseret på dansk til trænere i hallen.</p>
                        <span className="mt-2.5 inline-block bg-brand-dark/10 text-brand-dark text-xs font-bold px-3 py-1 rounded-md">Dansk (DK)</span>
                      </div>

                      <div className="border-b border-slate-100 pb-5">
                        <h4 className="text-sm font-bold text-slate-800 mb-1">Eksport på din enhed</h4>
                        <p className="text-xs text-slate-500">Klip laves direkte i din browser – videoen sendes ingen steder. På iPhone og iPad kræver det iOS 26 eller nyere.</p>
                      </div>

                      <div className="pb-2">
                        <h4 className="text-sm font-bold text-slate-800 mb-1">Ryd lokallager (Kloge trænere rydder op)</h4>
                        <p className="text-xs text-slate-500">Sletter alle gemte projekter, samlinger og cacher i din enheds database permanent.</p>
                        <button
                          onClick={async () => {
                            if (confirm("Er du helt sikker på, du vil rydde ALT? Dette sletter alle dine analyserede klip, mockups og samlinger.")) {
                              indexedDB.deleteDatabase("CoachClipDB");
                              alert("Databasen er ryddet. Siden genstartes.");
                              window.location.reload();
                            }
                          }}
                          className="mt-4 px-4 py-2.5 bg-brand-error/15 hover:bg-brand-error text-brand-error hover:text-white text-xs font-black rounded-xl border border-brand-error/25 transition-all cursor-pointer"
                        >
                          Nulstil alle CoachClip data
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* Bottom Nav Mobile Navigation */}
      {!isEditingVideo && (
        <BottomNav 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab} 
          onNewClip={handleNewClipTrigger} 
        />
      )}

      {/* MISSING VIDEO RESTORE OVERLAY MODAL */}
      {projectToRestore && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 sm:p-8 shadow-2xl text-center relative animate-scale-up select-none">
            <button
              onClick={() => setProjectToRestore(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 bg-amber-50 text-amber-500 border border-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">Video kan ikke findes</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed font-medium">
              CoachClip gemmer aldrig selve videoen på enheden.<br />
              Vælg filen <strong className="text-slate-800">"{projectToRestore.sourceVideo.fileName}"</strong> igen for at fortsætte.
            </p>

            <button
              onClick={() => restoreFileInputRef.current?.click()}
              className="w-full py-3.5 bg-brand-clear hover:bg-blue-600 text-white font-extrabold text-sm rounded-xl cursor-pointer shadow-md shadow-brand-clear/15"
            >
              Vælg videofil
            </button>
            <input
              ref={restoreFileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleRestoreVideoFile}
            />
          </div>
        </div>
      )}

      {/* RENAME PROJECT MODAL */}
      {renameProjectId && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl relative animate-scale-up">
            <h3 className="text-lg font-black text-slate-850 mb-3.5">Omdøb projekt</h3>
            <input
              type="text"
              required
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full p-3.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-brand-clear mb-5"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRenameProjectId(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
              >
                Annuller
              </button>
              <button
                onClick={saveRename}
                className="px-5 py-2.5 bg-brand-clear hover:bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Gem omdøbning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMMERSIVE PLAY/PREVIEW DIALOG FOR COMPLETED CLIPS */}
      {previewProject && (
        <PreviewScreen
          project={previewProject}
          onClose={() => setPreviewProject(null)}
          onEdit={() => {
            setPreviewProject(null);
            selectProjectForEditing(previewProject);
          }}
          videoUrl={videoUrl}
        />
      )}

    </div>
  );
}
