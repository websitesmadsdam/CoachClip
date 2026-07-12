/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Film, LayoutGrid, FolderHeart, Settings, PlusCircle, 
  Upload, Sparkles, Plus, AlertCircle, Trash2, Edit, Play,
  Copy, Check, Share2, Download, AlertTriangle, RefreshCw, X, CheckCircle2
} from "lucide-react";
import { CoachClipProject, Collection, Annotation, BRAND_COLORS } from "./types";
import { dbService } from "./db";
import { Sidebar } from "./components/Sidebar";
import { BottomNav } from "./components/BottomNav";

// Screen Views
import { HomeScreen } from "./screens/HomeScreen";
import { VideoSelectScreen } from "./screens/VideoSelectScreen";
import { ClipSelectScreen } from "./screens/ClipSelectScreen";
import { ClipFineTuneScreen } from "./screens/ClipFineTuneScreen";
import { AnnotationEditor } from "./features/annotations/AnnotationEditor";
import { PreviewScreen } from "./screens/PreviewScreen";
import { SaveProjectScreen } from "./screens/SaveProjectScreen";
import { ProjectLibraryScreen } from "./screens/ProjectLibraryScreen";
import { ExportScreen } from "./components/ExportScreen";
import { CollectionsScreen } from "./components/CollectionsScreen";
import { useObjectUrl } from "./hooks/useObjectUrl";

// Flag to toggle seeding of demo data
const ENABLE_DEMO_DATA = true;

// Sample Stock Video for high contrast prototyping
const DEFAULT_VIDEO_URL = "https://assets.mixkit.co/videos/preview/mixkit-player-jumping-in-a-basketball-game-34283-large.mp4";

export default function App() {
  // Current tab: "home" | "projects" | "collections" | "settings"
  const [currentTab, setCurrentTab] = useState<string>("home");

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

  // Handle local video upload/parsing
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

  // Restoring a project whose video ObjectUrl has expired
  const handleRestoreVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && projectToRestore) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setVideoDuration(projectToRestore.sourceVideo.duration);
      setTrimRange(projectToRestore.clip);
      setAnnotations(projectToRestore.annotations);
      setActiveProject(projectToRestore);
      
      setProjectToRestore(null);
      setEditorStep("editor");
    }
  };

  const selectProjectForEditing = (proj: CoachClipProject) => {
    // If original video was uploaded from local storage, we prompt user to reconnect
    const downloadUrl = proj.export?.downloadUrl;
    if (!downloadUrl && !proj.exportedVideoUrl && proj.id !== "mock_1" && proj.id !== "mock_2") {
      setProjectToRestore(proj);
      return;
    }

    const url = downloadUrl || proj.exportedVideoUrl || DEFAULT_VIDEO_URL;
    setVideoSourceSafely(url);
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
      exportStatus: exportNow ? "exporting" : "not_exported",
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

  const handleExportSuccess = async (exportResult: NonNullable<CoachClipProject["export"]>) => {
    if (!activeProject) return;
    
    const finished: CoachClipProject = {
      ...activeProject,
      exportStatus: "exported",
      export: exportResult,
      updatedAt: new Date().toISOString()
    };

    await dbService.saveProject(finished);
    setActiveProject(finished);
    await loadProjectsData();
    setEditorStep("success");
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
    setPreviewProject(proj);
    setPreviewCurrentTime(proj.clip.startTime);
  };

  const handlePreviewTimeUpdate = () => {
    const video = previewVideoRef.current;
    if (!video || !previewProject) return;

    setPreviewCurrentTime(video.currentTime);
    if (video.currentTime >= previewProject.clip.endTime) {
      video.currentTime = previewProject.clip.startTime;
    }
  };

  const isEditingVideo = ["choose", "trim", "adjust", "editor", "review", "save", "exporting", "success"].includes(editorStep);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 select-none">
      
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
                onUseStockVideo={() => {
                  setSelectedFile(new File([], "Demo_Basketball_Video.mp4"));
                  setVideoSourceSafely(DEFAULT_VIDEO_URL);
                  setVideoDuration(20);
                  setTrimRange({ startTime: 0, endTime: 20 });
                  setEditorStep("trim");
                }}
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

                {/* Overlays preview area */}
                <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                  <video
                    ref={previewVideoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain pointer-events-none"
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

                  {/* Overlays */}
                  <div className="absolute inset-0 pointer-events-none select-none z-20">
                    <svg className="w-full h-full absolute inset-0">
                      <defs>
                        <marker id="arrow-rev-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill={BRAND_COLORS.accent} />
                        </marker>
                        <marker id="arrow-rev-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill={BRAND_COLORS.error} />
                        </marker>
                        <marker id="arrow-rev-white" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#FFFFFF" />
                        </marker>
                      </defs>

                      {annotations.filter(a => a.type === "arrow" && previewCurrentTime >= a.startTime && previewCurrentTime <= a.endTime).map((arrow: any) => (
                        <line
                          key={arrow.id}
                          x1={`${arrow.startX * 100}%`}
                          y1={`${arrow.startY * 100}%`}
                          x2={`${arrow.endX * 100}%`}
                          y2={`${arrow.endY * 100}%`}
                          stroke={arrow.color === "yellow" ? BRAND_COLORS.accent : arrow.color === "red" ? BRAND_COLORS.error : "#FFFFFF"}
                          strokeWidth="4"
                          markerEnd={`url(#arrow-rev-${arrow.color})`}
                        />
                      ))}
                    </svg>

                    {annotations.filter(a => a.type === "circle" && previewCurrentTime >= a.startTime && previewCurrentTime <= a.endTime).map((circle: any) => (
                      <div
                        key={circle.id}
                        className="absolute rounded-full border-4"
                        style={{
                          left: `${circle.x * 100}%`,
                          top: `${circle.y * 100}%`,
                          width: `${circle.radius * 200}%`,
                          height: `${circle.radius * 200}%`,
                          transform: "translate(-50%, -50%)",
                          borderColor: circle.color === "yellow" ? BRAND_COLORS.accent : circle.color === "red" ? BRAND_COLORS.error : "#FFFFFF",
                          borderStyle: circle.thickness === "bold" ? "solid" : "dashed",
                          backgroundColor: "rgba(255, 176, 32, 0.05)"
                        }}
                      />
                    ))}

                    {annotations.filter(a => a.type === "text" && previewCurrentTime >= a.startTime && previewCurrentTime <= a.endTime).map((text: any) => (
                      <div
                        key={text.id}
                        className="absolute px-3 py-1.5 rounded-lg text-white font-semibold bg-black/80 shadow text-center max-w-[220px]"
                        style={{
                          left: `${text.x * 100}%`,
                          top: `${text.y * 100}%`,
                          transform: "translate(-50%, -50%)",
                          fontSize: text.size === "small" ? "12px" : text.size === "large" ? "18px" : "15px",
                        }}
                      >
                        {text.text}
                      </div>
                    ))}
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

            {/* Screen 8: Simulated Export Loader */}
            {editorStep === "exporting" && activeProject && (
              <ExportScreen
                project={activeProject}
                sourceFile={selectedFile}
                onExportSuccess={handleExportSuccess}
                onExportFailed={(errorMsg) => {
                  if (errorMsg && errorMsg !== "Eksporten blev afbrudt." && errorMsg !== "Afbrudt af bruger.") {
                    alert(errorMsg);
                  }
                  setEditorStep("save");
                }}
              />
            )}

            {/* Screen 9: Success & Share Options */}
            {editorStep === "success" && activeProject && (
              <div className="w-full max-w-md mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm text-center animate-scale-up">
                <div className="w-16 h-16 bg-green-50 text-brand-success rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="text-xl font-black text-brand-dark mb-1">Dit klip er klar!</h3>
                <p className="text-xs text-slate-400 font-medium mb-6">Det færdige analysebillede og videoen er pakket og klar til brug.</p>

                {/* Details card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6 flex flex-col gap-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Klippets titel:</span>
                    <span className="text-slate-800 font-extrabold max-w-[200px] truncate">{activeProject.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Varighed:</span>
                    <span className="text-slate-800 font-extrabold">{(activeProject.clip.endTime - activeProject.clip.startTime).toFixed(1)} sekunder</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Format / Opløsning:</span>
                    <span className="text-slate-800 font-extrabold">MP4 / 1080p Full HD</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: activeProject.title,
                          text: `Se denne sportsanalyse: ${activeProject.title}`,
                          url: window.location.href,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Delingslink kopieret til udklipsholderen! Del det via Messenger, Holdsport, Holdsport eller WhatsApp.");
                      }
                    }}
                    className="w-full py-3.5 bg-brand-clear hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-brand-clear/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <Share2 className="w-4.5 h-4.5" />
                    <span>Del klip</span>
                  </button>

                  <a
                    href={activeProject.export?.downloadUrl || activeProject.exportedVideoUrl || videoUrl}
                    download={activeProject.export?.fileName || `${activeProject.title.replace(/\s+/g, "_")}.mp4`}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-850 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <Download className="w-4.5 h-4.5" />
                    <span>Download MP4</span>
                  </a>

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

            {/* Tab 4: Settings page */}
            {currentTab === "settings" && (
              <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm animate-scale-up">
                <h3 className="text-xl font-black text-brand-dark mb-1">Indstillinger</h3>
                <p className="text-xs text-slate-400 mb-6 font-medium">Tilpas din CoachClip oplevelse og styr lokallageret.</p>

                <div className="flex flex-col gap-6">
                  <div className="border-b border-slate-100 pb-5">
                    <h4 className="text-sm font-bold text-slate-800 mb-1">Sprog</h4>
                    <p className="text-xs text-slate-500">CoachClip er fuldt lokaliseret på dansk til trænere i hallen.</p>
                    <span className="mt-2.5 inline-block bg-brand-dark/10 text-brand-dark text-xs font-bold px-3 py-1 rounded-md">Dansk (DK)</span>
                  </div>

                  <div className="border-b border-slate-100 pb-5">
                    <h4 className="text-sm font-bold text-slate-800 mb-1">PWA Offline status</h4>
                    <p className="text-xs text-slate-500">Du kan installere CoachClip på din hjemmeskærm, så du altid har taktikklip klar offline.</p>
                    <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-brand-success">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-success animate-ping" />
                      <span>Klar til offline-brug (Service Worker Aktiv)</span>
                    </div>
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
              For at beskytte dit lager gemmer CoachClip ikke tunge rå-videoer i skyen.<br />
              Vælg filen <strong className="text-slate-800">"{projectToRestore.sourceVideo.fileName}"</strong> igen for at fortsætte redigeringen.
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
          videoUrl={previewProject.export?.downloadUrl || previewProject.exportedVideoUrl || DEFAULT_VIDEO_URL}
        />
      )}

    </div>
  );
}
