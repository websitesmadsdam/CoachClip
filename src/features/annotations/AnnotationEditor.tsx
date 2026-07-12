/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { 
  Play, Pause, RotateCcw, ChevronRight, Check, ArrowLeft,
  Type, Circle, MoveUpRight, Snowflake, Info
} from "lucide-react";
import { Annotation, TextAnnotation, CircleAnnotation, ArrowAnnotation, FreezeAnnotation } from "../../types";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { AnnotationList } from "./AnnotationList";
import { TextAnnotationForm } from "./text/TextAnnotationForm";
import { CircleAnnotationForm } from "./circle/CircleAnnotationForm";
import { ArrowAnnotationForm } from "./arrow/ArrowAnnotationForm";
import { FreezeAnnotationForm } from "./freeze/FreezeAnnotationForm";
import { useVideoPlayback } from "../../hooks/useVideoPlayback";
import { useFreezePlayback } from "../../hooks/useFreezePlayback";
import { useAnnotationSelection } from "../../hooks/useAnnotationSelection";
import { formatPreciseTime } from "../../utils/videoUtils";

interface AnnotationEditorProps {
  videoUrl: string;
  startTime: number;
  endTime: number;
  initialAnnotations?: Annotation[];
  onComplete: (annotations: Annotation[]) => void;
  onBack: () => void;
}

export const AnnotationEditor: React.FC<AnnotationEditorProps> = ({
  videoUrl,
  startTime,
  endTime,
  initialAnnotations = [],
  onComplete,
  onBack,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for all saved annotations
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  
  // Active tool choice: null | "text" | "circle" | "arrow" | "freeze"
  const [activeTool, setActiveTool] = useState<"text" | "circle" | "arrow" | "freeze" | null>(null);

  // Active temporary drawing draft
  const [draftAnnotation, setDraftAnnotation] = useState<Partial<Annotation> | null>(null);

  // Playback hook
  const {
    videoRef,
    isPlaying,
    currentTime,
    playbackRate,
    setPlaybackRate,
    togglePlay,
    pause: pauseVideo,
    play: playVideo,
    seekRelative,
    seekTo,
  } = useVideoPlayback(videoUrl, startTime, endTime);

  // Freeze frames hook
  const {
    freezeActiveId,
    freezeRemaining,
  } = useFreezePlayback(
    currentTime,
    annotations,
    startTime,
    pauseVideo,
    playVideo
  );

  // Selection & keyboard controls hook
  const {
    selectedAnnotationId,
    setSelectedAnnotationId,
    selectedAnnotation,
    handleAnnotationSelect,
    deleteAnnotation,
  } = useAnnotationSelection(annotations, setAnnotations, currentTime, videoRef);

  // Pause when editing or picking a tool
  useEffect(() => {
    if (activeTool || draftAnnotation) {
      pauseVideo();
    }
  }, [activeTool, draftAnnotation, pauseVideo]);

  // Handle saving of active draft
  const saveDraft = () => {
    if (!draftAnnotation) return;

    if (draftAnnotation.type === "text" && !(draftAnnotation as TextAnnotation).text?.trim()) {
      alert("Indtast venligst en tekstkommentar først.");
      return;
    }

    setAnnotations((prev) => [...prev, draftAnnotation as Annotation]);
    setDraftAnnotation(null);
    setActiveTool(null);
  };

  const cancelDraft = () => {
    setDraftAnnotation(null);
    setActiveTool(null);
  };

  // Add a freeze-point immediately at the current frame
  const handleAddFreeze = () => {
    pauseVideo();
    const id = "freeze_" + Date.now();
    const draft: FreezeAnnotation = {
      id,
      type: "freeze",
      time: currentTime,
      duration: 3,
    };
    setDraftAnnotation(draft);
  };

  const handleUndo = () => {
    if (annotations.length > 0) {
      setAnnotations((prev) => prev.slice(0, -1));
    }
  };

  const handleUpdateAnnotation = (updated: Annotation) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Bar Navigation */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 rounded-xl transition-all cursor-pointer"
            title="Gå tilbage"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">Forklar situationen</h1>
            <p className="text-xs text-slate-400">
              Tilføj fokuspunkter, pile, cirkler eller frysepunkter for at forklare din taktik.
            </p>
          </div>
        </div>

        <button
          onClick={() => onComplete(annotations)}
          className="bg-brand-clear hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg hover:shadow-blue-500/10 cursor-pointer transition-all"
        >
          <Check className="w-4 h-4" />
          <span>Næste: Gennemse klip</span>
        </button>
      </div>

      {/* Main Content splits left/right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        
        {/* Left Side: Video Player Workspace */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8 overflow-y-auto bg-slate-950">
          
          {/* Interactive Player Window */}
          <div 
            ref={containerRef}
            className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center select-none touch-none"
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain pointer-events-none"
              preload="auto"
              playsInline
              muted
            />

            {/* Event Overlay */}
            <AnnotationOverlay
              annotations={annotations}
              currentTime={currentTime}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={handleAnnotationSelect}
              onUpdateAnnotation={handleUpdateAnnotation}
              activeTool={activeTool}
              draftAnnotation={draftAnnotation}
              onUpdateDraft={setDraftAnnotation}
              containerRef={containerRef}
            />

            {/* Instruction Overlay when tool is chosen but draft not drawn */}
            {activeTool && !draftAnnotation && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-crosshair z-30 pointer-events-none">
                <div className="bg-slate-900/95 border border-amber-500/40 text-amber-300 p-4 rounded-xl text-center max-w-xs shadow-2xl animate-fade-in flex flex-col items-center gap-2">
                  <Info className="w-5 h-5 text-amber-400" />
                  <p className="text-xs font-bold leading-relaxed">
                    {activeTool === "text" && "Klik på skærmen for at placere teksten."}
                    {activeTool === "circle" && "Klik på den spiller eller zone, du vil indkredse."}
                    {activeTool === "arrow" && "Klik og træk på videoen for at tegne bevægelsespilen."}
                  </p>
                </div>
              </div>
            )}

            {/* Active Freeze Overlay (Large visual countdown timer) */}
            {freezeActiveId && (
              <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center z-40 backdrop-blur-xs">
                <div className="bg-slate-900 border-2 border-sky-400 rounded-2xl p-6 text-center text-white flex flex-col items-center gap-4 shadow-2xl animate-scale-up">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <Snowflake className="w-10 h-10 text-sky-400 animate-pulse" />
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.15)" strokeWidth="4" fill="transparent" />
                      <circle cx="32" cy="32" r="28" stroke="#38bdf8" strokeWidth="4" fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - freezeRemaining / 3)}`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm uppercase tracking-wider text-sky-400 leading-none">AFSPILNING FRYST</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Gennemser situationen ({freezeRemaining}s)</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick inline toolbar (Mobile only) */}
          <div className="flex lg:hidden items-center justify-around w-full max-w-md mt-4 bg-slate-900 border border-slate-800 p-2.5 rounded-xl gap-2 text-white shadow">
            <button
              onClick={() => { setActiveTool("text"); setDraftAnnotation(null); }}
              className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] ${
                activeTool === "text" ? "bg-brand-clear text-white font-bold" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Type className="w-4 h-4" />
              <span>Tekst</span>
            </button>
            <button
              onClick={() => { setActiveTool("circle"); setDraftAnnotation(null); }}
              className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] ${
                activeTool === "circle" ? "bg-brand-clear text-white font-bold" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Circle className="w-4 h-4" />
              <span>Cirkel</span>
            </button>
            <button
              onClick={() => { setActiveTool("arrow"); setDraftAnnotation(null); }}
              className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] ${
                activeTool === "arrow" ? "bg-brand-clear text-white font-bold" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <MoveUpRight className="w-4 h-4" />
              <span>Pil</span>
            </button>
            <button
              onClick={handleAddFreeze}
              className="flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Snowflake className="w-4 h-4 text-sky-400" />
              <span>Frys</span>
            </button>
          </div>

          {/* Control Bar & Playback Timeline */}
          <div className="w-full max-w-4xl flex items-center justify-between gap-4 mt-4 text-white shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => seekRelative(-2, endTime)}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl cursor-pointer"
                title="2 sekunder tilbage"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlay}
                className="p-3 bg-brand-clear hover:bg-blue-600 rounded-full cursor-pointer transition-transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white text-white" /> : <Play className="w-4 h-4 fill-white text-white" />}
              </button>

              <button
                onClick={() => seekRelative(2, endTime)}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl cursor-pointer"
                title="2 sekunder frem"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Speed selection */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1.5 rounded-xl shrink-0">
              <span className="text-[9px] font-bold text-slate-500 uppercase px-1">Fart:</span>
              {([0.5, 1, 2] as const).map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    playbackRate === rate ? "bg-brand-clear text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Custom interactive mini-timeline */}
            <div 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = clickX / rect.width;
                const targetTime = startTime + ratio * (endTime - startTime);
                seekTo(targetTime);
              }}
              className="flex-1 h-3.5 bg-slate-950 border border-slate-800 rounded-full relative overflow-hidden cursor-pointer"
            >
              {/* Playback progress cursor indicator */}
              <div
                className="absolute h-full bg-slate-700 w-[2px] z-10"
                style={{
                  left: `${((currentTime - startTime) / (endTime - startTime)) * 100}%`,
                }}
              />
              {/* Highlight active segments */}
              {annotations.map((a) => {
                if (a.type === "freeze") {
                  return (
                    <div
                      key={a.id}
                      className="absolute top-0 bottom-0 w-2.5 bg-sky-400 border-x border-slate-950"
                      style={{
                        left: `${((a.time - startTime) / (endTime - startTime)) * 100}%`,
                        transform: "translateX(-50%)",
                      }}
                      title={`Frysved ${formatPreciseTime(a.time)}`}
                    />
                  );
                }
                const left = ((a.startTime - startTime) / (endTime - startTime)) * 100;
                const width = ((a.endTime - a.startTime) / (endTime - startTime)) * 100;
                return (
                  <div
                    key={a.id}
                    className="absolute h-2 bg-brand-clear/40 top-0.5 rounded"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                );
              })}
            </div>

            <span className="font-mono text-xs font-semibold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              {formatPreciseTime(currentTime)}
            </span>
          </div>
        </div>

        {/* Right Side: Control Panels */}
        <div className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
          {draftAnnotation ? (
            /* Editing State: Settings form for active drawing draft */
            <div className="p-5 flex flex-col gap-4">
              {draftAnnotation.type === "text" && (
                <TextAnnotationForm
                  annotation={draftAnnotation as TextAnnotation}
                  onChange={setDraftAnnotation}
                  onSave={saveDraft}
                  onCancel={cancelDraft}
                  clipEndTime={endTime}
                />
              )}
              {draftAnnotation.type === "circle" && (
                <CircleAnnotationForm
                  annotation={draftAnnotation as CircleAnnotation}
                  onChange={setDraftAnnotation}
                  onSave={saveDraft}
                  onCancel={cancelDraft}
                  clipEndTime={endTime}
                />
              )}
              {draftAnnotation.type === "arrow" && (
                <ArrowAnnotationForm
                  annotation={draftAnnotation as ArrowAnnotation}
                  onChange={setDraftAnnotation}
                  onSave={saveDraft}
                  onCancel={cancelDraft}
                  clipEndTime={endTime}
                />
              )}
              {draftAnnotation.type === "freeze" && (
                <FreezeAnnotationForm
                  annotation={draftAnnotation as FreezeAnnotation}
                  onChange={setDraftAnnotation}
                  onSave={saveDraft}
                  onCancel={cancelDraft}
                />
              )}
            </div>
          ) : selectedAnnotation ? (
            /* Selected State: edit form for selected annotation */
            <div className="p-5 flex flex-col gap-4">
              {selectedAnnotation.type === "text" && (
                <TextAnnotationForm
                  annotation={selectedAnnotation as TextAnnotation}
                  onChange={handleUpdateAnnotation}
                  onSave={() => setSelectedAnnotationId(null)}
                  onCancel={() => setSelectedAnnotationId(null)}
                  onDelete={() => deleteAnnotation(selectedAnnotation.id)}
                  clipEndTime={endTime}
                />
              )}
              {selectedAnnotation.type === "circle" && (
                <CircleAnnotationForm
                  annotation={selectedAnnotation as CircleAnnotation}
                  onChange={handleUpdateAnnotation}
                  onSave={() => setSelectedAnnotationId(null)}
                  onCancel={() => setSelectedAnnotationId(null)}
                  onDelete={() => deleteAnnotation(selectedAnnotation.id)}
                  clipEndTime={endTime}
                />
              )}
              {selectedAnnotation.type === "arrow" && (
                <ArrowAnnotationForm
                  annotation={selectedAnnotation as ArrowAnnotation}
                  onChange={handleUpdateAnnotation}
                  onSave={() => setSelectedAnnotationId(null)}
                  onCancel={() => setSelectedAnnotationId(null)}
                  onDelete={() => deleteAnnotation(selectedAnnotation.id)}
                  clipEndTime={endTime}
                />
              )}
              {selectedAnnotation.type === "freeze" && (
                <FreezeAnnotationForm
                  annotation={selectedAnnotation as FreezeAnnotation}
                  onChange={handleUpdateAnnotation}
                  onSave={() => setSelectedAnnotationId(null)}
                  onCancel={() => setSelectedAnnotationId(null)}
                  onDelete={() => deleteAnnotation(selectedAnnotation.id)}
                />
              )}
            </div>
          ) : (
            /* Default State: Tools Toolbar and Annotation list */
            <div className="flex-1 flex flex-col min-h-0 divide-y divide-slate-200">
              <div className="p-5">
                <AnnotationToolbar
                  activeTool={activeTool}
                  onSelectTool={setActiveTool}
                  onUndo={handleUndo}
                  onAddFreeze={handleAddFreeze}
                  hasAnnotations={annotations.length > 0}
                />
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <AnnotationList
                  annotations={annotations}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={handleAnnotationSelect}
                  onDeleteAnnotation={deleteAnnotation}
                  startTime={startTime}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
