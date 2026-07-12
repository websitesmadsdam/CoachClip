/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: Large legacy EditorScreen editor component contains raw any and unused variables for compatibility with existing UI structure.
 */

import React, { useRef, useState, useEffect } from "react";
import { 
  Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Check, Trash2, 
  Type, Circle, MoveUpRight, Snowflake, Undo, Eye, Edit2, AlertCircle 
} from "lucide-react";
import { Annotation, CoachClipProject, BRAND_COLORS } from "../types";

interface EditorScreenProps {
  videoUrl: string;
  startTime: number;
  endTime: number;
  initialAnnotations?: Annotation[];
  onComplete: (annotations: Annotation[]) => void;
  onBack: () => void;
}

export const EditorScreen: React.FC<EditorScreenProps> = ({
  videoUrl,
  startTime,
  endTime,
  initialAnnotations = [],
  onComplete,
  onBack,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  
  // Annotations collection
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Active Tool state: null | "text" | "circle" | "arrow" | "freeze"
  const [activeTool, setActiveTool] = useState<"text" | "circle" | "arrow" | "freeze" | null>(null);

  // Freeze Active Countdown
  const [freezeRemaining, setFreezeRemaining] = useState<number>(0);
  const [freezeActiveId, setFreezeActiveId] = useState<string | null>(null);
  const [triggeredFreezeIds, setTriggeredFreezeIds] = useState<Set<string>>(new Set());

  // State for the annotation being added/edited
  const [draftAnnotation, setDraftAnnotation] = useState<Partial<Annotation> | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragPart, setDragPart] = useState<"center" | "start" | "end" | "radius" | null>(null);

  // Sync video source starting time
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [startTime]);

  // Video playback loop within start/end range
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && !freezeActiveId) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, freezeActiveId]);

  // Handle active freeze countdown timer
  useEffect(() => {
    if (freezeRemaining <= 0) {
      if (freezeActiveId) {
        setFreezeActiveId(null);
        // Resume playing if it was playing before
        setIsPlaying(true);
      }
      return;
    }

    const timer = setTimeout(() => {
      setFreezeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [freezeRemaining, freezeActiveId]);

  // Check and trigger freeze annotations
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    setCurrentTime(current);

    // End of clip loop back
    if (current >= endTime) {
      video.currentTime = startTime;
      setCurrentTime(startTime);
      // Reset triggered freezes for the new loop
      setTriggeredFreezeIds(new Set());
      return;
    }

    if (current < startTime) {
      video.currentTime = startTime;
      setCurrentTime(startTime);
      return;
    }

    // Check for freezes at current playback time
    const freezes = annotations.filter(a => a.type === "freeze") as any[];
    for (const f of freezes) {
      // If we are close to the freeze time (within 0.2s) and haven't triggered it in this run
      if (Math.abs(current - f.time) < 0.25 && !triggeredFreezeIds.has(f.id) && !freezeActiveId) {
        // Trigger Freeze Frame!
        setIsPlaying(false);
        setFreezeActiveId(f.id);
        setFreezeRemaining(f.duration);
        setTriggeredFreezeIds(prev => {
          const next = new Set(prev);
          next.add(f.id);
          return next;
        });
        break;
      }
    }
  };

  // Seek relative
  const seekRelative = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    let target = video.currentTime + seconds;
    if (target < startTime) target = startTime;
    if (target > endTime) target = endTime;
    video.currentTime = target;
    setCurrentTime(target);
  };

  // Dragging logic for custom overlay placement
  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0.5, y: 0.5 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    };
  };

  // Clicking on overlay to place circle or start arrow or text
  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTool) return;
    const coords = getRelativeCoords(e);

    // Pause video while adding annotations
    setIsPlaying(false);

    if (activeTool === "text") {
      setDraftAnnotation({
        id: "text_" + Date.now(),
        type: "text",
        startTime: currentTime,
        endTime: Math.min(endTime, currentTime + 3),
        text: "",
        x: coords.x,
        y: coords.y,
        size: "normal",
        positionPreset: "bottom"
      });
      setIsDragging(true);
      setDragPart("center");
    } else if (activeTool === "circle") {
      setDraftAnnotation({
        id: "circle_" + Date.now(),
        type: "circle",
        startTime: currentTime,
        endTime: Math.min(endTime, currentTime + 3),
        x: coords.x,
        y: coords.y,
        radius: 0.08,
        color: "yellow",
        thickness: "bold"
      });
      setIsDragging(true);
      setDragPart("center");
    } else if (activeTool === "arrow") {
      setDraftAnnotation({
        id: "arrow_" + Date.now(),
        type: "arrow",
        startTime: currentTime,
        endTime: Math.min(endTime, currentTime + 3),
        startX: coords.x,
        startY: coords.y,
        endX: coords.x + 0.1,
        endY: coords.y - 0.1,
        color: "yellow"
      });
      setIsDragging(true);
      setDragPart("end"); // start dragging the head of the arrow
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !draftAnnotation) return;
    const coords = getRelativeCoords(e);

    if (draftAnnotation.type === "text") {
      setDraftAnnotation(prev => prev ? { ...prev, x: coords.x, y: coords.y } : null);
    } else if (draftAnnotation.type === "circle") {
      if (dragPart === "center") {
        setDraftAnnotation(prev => prev ? { ...prev, x: coords.x, y: coords.y } : null);
      } else if (dragPart === "radius") {
        const da = draftAnnotation as any;
        const dx = coords.x - da.x;
        const dy = coords.y - da.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        setDraftAnnotation(prev => prev ? { ...prev, radius: Math.max(0.03, Math.min(0.3, dist)) } : null);
      }
    } else if (draftAnnotation.type === "arrow") {
      const da = draftAnnotation as any;
      if (dragPart === "start") {
        setDraftAnnotation(prev => prev ? { ...prev, startX: coords.x, startY: coords.y } : null);
      } else if (dragPart === "end") {
        setDraftAnnotation(prev => prev ? { ...prev, endX: coords.x, endY: coords.y } : null);
      }
    }
  };

  const handleOverlayMouseUp = () => {
    setIsDragging(false);
    setDragPart(null);
  };

  // Edit / Action items on saved annotations
  const handleAnnotationSelect = (anno: Annotation) => {
    setSelectedAnnotationId(anno.id);
    // Seek video to the start time of this annotation
    if (videoRef.current) {
      videoRef.current.currentTime = anno.type === "freeze" ? anno.time : anno.startTime;
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const undoLastAnnotation = () => {
    if (annotations.length > 0) {
      setAnnotations(prev => prev.slice(0, -1));
    }
  };

  // Tool Specific Save Handlers
  const saveDraftAnnotation = () => {
    if (!draftAnnotation) return;

    // Validation for text
    if (draftAnnotation.type === "text" && !(draftAnnotation as any).text.trim()) {
      alert("Skriv venligst noget tekst først.");
      return;
    }

    setAnnotations(prev => [...prev, draftAnnotation as Annotation]);
    setDraftAnnotation(null);
    setActiveTool(null);
  };

  const cancelDraftAnnotation = () => {
    setDraftAnnotation(null);
    setActiveTool(null);
  };

  const triggerAddFreeze = () => {
    const time = currentTime;
    const id = "freeze_" + Date.now();
    const newFreeze: Annotation = {
      id,
      type: "freeze",
      time,
      duration: 3 // default
    };
    setAnnotations(prev => [...prev, newFreeze]);
    setActiveTool(null);
  };

  // Format helper for listing
  const formatTimeRange = (start: number, end: number) => {
    const pad = (n: number) => Math.floor(n).toString().padStart(2, "0");
    const m1 = pad((start - startTime) / 60);
    const s1 = pad((start - startTime) % 60);
    const m2 = pad((end - startTime) / 60);
    const s2 = pad((end - startTime) % 60);
    return `${m1}:${s1}–${m2}:${s2}`;
  };

  const formatFreezeTime = (time: number) => {
    const pad = (n: number) => Math.floor(n).toString().padStart(2, "0");
    const m = pad((time - startTime) / 60);
    const s = pad((time - startTime) % 60);
    return `${m}:${s}`;
  };

  const handleFinishEditing = () => {
    onComplete(annotations);
  };

  // Get active annotations at current frame (taking freeze frames into consideration)
  const getActiveAnnotations = () => {
    // If a freeze frame is actively running, show annotations matching the freeze time
    if (freezeActiveId) {
      const activeFreeze = annotations.find(a => a.id === freezeActiveId);
      if (activeFreeze) {
        const freezeTime = (activeFreeze as any).time;
        return annotations.filter(a => {
          if (a.type === "freeze") return a.id === freezeActiveId;
          return freezeTime >= a.startTime && freezeTime <= a.endTime;
        });
      }
    }

    // Normal active frame check
    return annotations.filter(a => {
      if (a.type === "freeze") {
        return Math.abs(currentTime - a.time) < 0.25;
      }
      return currentTime >= a.startTime && currentTime <= a.endTime;
    });
  };

  const activeAnnotations = getActiveAnnotations();

  // Pre-cast draft variables to avoid in-JSX type assertions
  const dText = (draftAnnotation && draftAnnotation.type === "text") ? draftAnnotation as any : null;
  const dCircle = (draftAnnotation && draftAnnotation.type === "circle") ? draftAnnotation as any : null;
  const dArrow = (draftAnnotation && draftAnnotation.type === "arrow") ? draftAnnotation as any : null;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col h-full bg-brand-panel rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top Header info */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-brand-dark">Tilføj forklaring</h2>
            <p className="text-xs text-slate-500">Forklar situationen ved at tilføje tekst, cirkler, pile eller frys.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={undoLastAnnotation}
            disabled={annotations.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <Undo className="w-4 h-4" />
            <span>Fortryd sidste</span>
          </button>

          <button
            onClick={handleFinishEditing}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-clear hover:bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-md cursor-pointer transition-all active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>Gennemse klip</span>
          </button>
        </div>
      </div>

      {/* Main editor core layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        
        {/* Left Toolbar (Desktop Only) */}
        <div className="hidden lg:flex w-64 bg-slate-50 border-r border-slate-200 p-5 flex-col gap-6 overflow-y-auto shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 text-xs mb-1 uppercase tracking-wider">Værktøjer</h3>
            <p className="text-[11px] text-slate-500">Vælg et værktøj for at fremhæve detaljer i videoen.</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => { setActiveTool("text"); setDraftAnnotation(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                activeTool === "text"
                  ? "border-brand-clear bg-brand-clear/5 text-brand-clear font-bold"
                  : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
              }`}
            >
              <Type className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm leading-none">Tilføj tekst</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Indtast en forklaring på banen</p>
              </div>
            </button>

            <button
              onClick={() => { setActiveTool("circle"); setDraftAnnotation(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                activeTool === "circle"
                  ? "border-brand-clear bg-brand-clear/5 text-brand-clear font-bold"
                  : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
              }`}
            >
              <Circle className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm leading-none">Marker spiller</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Placer en gul cirkel på videoen</p>
              </div>
            </button>

            <button
              onClick={() => { setActiveTool("arrow"); setDraftAnnotation(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                activeTool === "arrow"
                  ? "border-brand-clear bg-brand-clear/5 text-brand-clear font-bold"
                  : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
              }`}
            >
              <MoveUpRight className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm leading-none">Vis bevægelse</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Tegn en gul pil på banen</p>
              </div>
            </button>

            <button
              onClick={() => { setActiveTool("freeze"); setDraftAnnotation(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                activeTool === "freeze"
                  ? "border-brand-clear bg-brand-clear/5 text-brand-clear font-bold"
                  : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
              }`}
            >
              <Snowflake className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm leading-none">Frys billede</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Sæt videoen på pause i et øjeblik</p>
              </div>
            </button>
          </div>

          {activeTool === "freeze" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Frys videoen her
              </span>
              <p className="text-[11px] text-amber-700">
                Dette stopper videoafspilningen på det aktuelle tidspunkt, så dine markeringer kan studeres i dybden.
              </p>
              <button
                onClick={triggerAddFreeze}
                className="w-full mt-2 py-2 bg-brand-accent hover:bg-amber-500 text-brand-dark font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Tilføj frys her
              </button>
            </div>
          )}
        </div>

        {/* Central Video & Stage Area */}
        <div className="flex-1 bg-[#0F172A] flex flex-col items-center justify-center p-4 min-h-[320px] relative overflow-hidden">
          
          {/* Main 16:9 Canvas Stage */}
          <div 
            ref={containerRef}
            onMouseDown={handleOverlayMouseDown}
            onMouseMove={handleOverlayMouseMove}
            onMouseUp={handleOverlayMouseUp}
            className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-black border border-slate-700 select-none group/stage"
          >
            {/* Native Video */}
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover pointer-events-none"
              onTimeUpdate={handleTimeUpdate}
              playsInline
            />

            {/* Interactive Drawing Overlays (Static SVG / absolute positioning) */}
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full absolute inset-0">
                <defs>
                  {/* Yellow, Red, White arrows head markers */}
                  <marker id="arrow-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={BRAND_COLORS.accent} />
                  </marker>
                  <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={BRAND_COLORS.error} />
                  </marker>
                  <marker id="arrow-white" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#FFFFFF" />
                  </marker>
                </defs>

                {/* Render active arrows */}
                {activeAnnotations.filter(a => a.type === "arrow").map((arrow: any) => (
                  <line
                    key={arrow.id}
                    x1={`${arrow.startX * 100}%`}
                    y1={`${arrow.startY * 100}%`}
                    x2={`${arrow.endX * 100}%`}
                    y2={`${arrow.endY * 100}%`}
                    stroke={arrow.color === "yellow" ? BRAND_COLORS.accent : arrow.color === "red" ? BRAND_COLORS.error : "#FFFFFF"}
                    strokeWidth="4"
                    markerEnd={`url(#arrow-${arrow.color})`}
                  />
                ))}

                {/* Render draft arrow if active */}
                {dArrow && (
                  <line
                    x1={`${dArrow.startX * 100}%`}
                    y1={`${dArrow.startY * 100}%`}
                    x2={`${dArrow.endX * 100}%`}
                    y2={`${dArrow.endY * 100}%`}
                    stroke={dArrow.color === "yellow" ? BRAND_COLORS.accent : dArrow.color === "red" ? BRAND_COLORS.error : "#FFFFFF"}
                    strokeWidth="4"
                    markerEnd={`url(#arrow-${dArrow.color})`}
                  />
                )}
              </svg>

              {/* Render active circles */}
              {activeAnnotations.filter(a => a.type === "circle").map((circle: any) => (
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
                  }}
                />
              ))}

              {/* Render draft circle if active */}
              {dCircle && (
                <div
                  className="absolute rounded-full border-4 animate-pulse"
                  style={{
                    left: `${dCircle.x * 100}%`,
                    top: `${dCircle.y * 100}%`,
                    width: `${dCircle.radius * 200}%`,
                    height: `${dCircle.radius * 200}%`,
                    transform: "translate(-50%, -50%)",
                    borderColor: dCircle.color === "yellow" ? BRAND_COLORS.accent : dCircle.color === "red" ? BRAND_COLORS.error : "#FFFFFF",
                    borderStyle: dCircle.thickness === "bold" ? "solid" : "dashed",
                  }}
                />
              )}

              {/* Render active texts */}
              {activeAnnotations.filter(a => a.type === "text").map((text: any) => (
                <div
                  key={text.id}
                  className="absolute px-3 py-1.5 rounded-lg text-white font-medium text-center shadow-md bg-black/65"
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

              {/* Render draft text if active */}
              {dText && (
                <div
                  className="absolute px-3 py-1.5 rounded-lg text-white font-medium text-center shadow-md bg-black/85 border border-brand-clear/50 animate-pulse"
                  style={{
                    left: `${dText.x * 100}%`,
                    top: `${dText.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: dText.size === "small" ? "12px" : dText.size === "large" ? "18px" : "15px",
                  }}
                >
                  {dText.text || "Skriver her..."}
                </div>
              )}
            </div>

            {/* Help instruction overlay when placing elements */}
            {activeTool && !draftAnnotation && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-crosshair">
                <div className="bg-brand-dark/95 border border-slate-600 text-white p-4 rounded-xl text-center max-w-xs shadow-xl animate-fade-in pointer-events-none">
                  {activeTool === "text" && "Tryk på videoen for at placere teksten."}
                  {activeTool === "circle" && "Tryk på spilleren eller området, du vil markere med en cirkel."}
                  {activeTool === "arrow" && "Træk din finger/mus henover videoen for at tegne pilen."}
                </div>
              </div>
            )}

            {/* Freeze Countdown Display */}
            {freezeActiveId && (
              <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center z-30">
                <div className="bg-brand-dark border-2 border-brand-accent rounded-2xl p-6 text-center text-white flex flex-col items-center gap-4 shadow-2xl animate-scale-up">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <Snowflake className="w-10 h-10 text-brand-accent animate-spin-slow" />
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.15)" strokeWidth="4" fill="transparent" />
                      <circle cx="32" cy="32" r="28" stroke={BRAND_COLORS.accent} strokeWidth="4" fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - freezeRemaining / 3)}`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-brand-accent">FRYS ANALYSE</h4>
                    <p className="text-xs text-slate-300 mt-1">Videoen er stoppet i {freezeRemaining}s</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick inline toolbar (Mobile only) */}
          <div className="flex lg:hidden items-center justify-around w-full max-w-md mt-4 bg-slate-800 p-2.5 rounded-xl gap-2 text-white shadow">
            <button
              onClick={() => { setActiveTool("text"); setDraftAnnotation(null); }}
              className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] ${
                activeTool === "text" ? "bg-brand-clear text-white" : "hover:bg-slate-700"
              }`}
            >
              <Type className="w-4 h-4" />
              <span>Tekst</span>
            </button>
            <button
              onClick={() => { setActiveTool("circle"); setDraftAnnotation(null); }}
              className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] ${
                activeTool === "circle" ? "bg-brand-clear text-white" : "hover:bg-slate-700"
              }`}
            >
              <Circle className="w-4 h-4" />
              <span>Marker spiller</span>
            </button>
            <button
              onClick={() => { setActiveTool("arrow"); setDraftAnnotation(null); }}
              className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] ${
                activeTool === "arrow" ? "bg-brand-clear text-white" : "hover:bg-slate-700"
              }`}
            >
              <MoveUpRight className="w-4 h-4" />
              <span>Vis bevægelse</span>
            </button>
            <button
              onClick={triggerAddFreeze}
              className="flex-1 py-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer text-[10px] hover:bg-slate-700"
            >
              <Snowflake className="w-4 h-4" />
              <span>Frys billede</span>
            </button>
          </div>

          {/* Video Control Bar & Timeline */}
          <div className="w-full max-w-4xl flex items-center justify-between gap-4 mt-4 text-white">
            <div className="flex items-center gap-3">
              <button
                onClick={() => seekRelative(-2)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                title="2 sekunder tilbage"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[8px] font-bold block mt-0.5">-2s</span>
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2.5 bg-brand-clear hover:bg-blue-600 rounded-full cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              <button
                onClick={() => seekRelative(2)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                title="2 sekunder frem"
              >
                <ChevronRight className="w-4 h-4" />
                <span className="text-[8px] font-bold block mt-0.5">+2s</span>
              </button>
            </div>

            {/* Custom mini-timeline showing annotations slots */}
            <div className="flex-1 h-3 bg-slate-800 rounded-full relative overflow-hidden">
              <div
                className="absolute h-full bg-slate-700"
                style={{
                  left: `${((currentTime - startTime) / (endTime - startTime)) * 100}%`,
                  width: "2px"
                }}
              />
              {/* Highlight active segments */}
              {annotations.map((a: any) => {
                if (a.type === "freeze") {
                  return (
                    <div
                      key={a.id}
                      className="absolute top-0 bottom-0 w-1.5 bg-brand-accent"
                      style={{
                        left: `${((a.time - startTime) / (endTime - startTime)) * 100}%`
                      }}
                    />
                  );
                }
                const left = ((a.startTime - startTime) / (endTime - startTime)) * 100;
                const width = ((a.endTime - a.startTime) / (endTime - startTime)) * 100;
                return (
                  <div
                    key={a.id}
                    className="absolute h-1 bg-brand-clear/40 top-1"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                );
              })}
            </div>

            <span className="font-mono text-xs font-semibold bg-slate-800 px-2.5 py-1 rounded">
              {formatTimeRange(currentTime, endTime).split("–")[0]}
            </span>
          </div>
        </div>

        {/* Right Pane: Annotations List & Draft Settings Panel */}
        <div className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col overflow-y-auto">
          
          {/* Draft Annotation Edit Box */}
          {draftAnnotation ? (
            <div className="p-5 border-b border-slate-200 bg-white shadow-inner flex flex-col gap-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-brand-dark flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-brand-clear" />
                Indstillinger for {draftAnnotation.type === "text" ? "Tekst" : draftAnnotation.type === "circle" ? "Cirkel" : "Pil"}
              </h4>

              {draftAnnotation.type === "text" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Skriv din kommentar (maks 120 tegn)</label>
                    <input
                      type="text"
                      maxLength={120}
                      value={(draftAnnotation as any).text}
                      onChange={(e) => setDraftAnnotation(prev => prev ? { ...prev, text: e.target.value } : null)}
                      placeholder="Skriv kommentar..."
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block text-right">
                      {(draftAnnotation as any).text?.length || 0}/120 tegn
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Placering i billede</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["top", "center", "bottom"] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setDraftAnnotation(prev => prev ? { ...prev, positionPreset: pos, y: pos === "top" ? 0.15 : pos === "center" ? 0.5 : 0.85 } : null)}
                          className={`text-xs font-medium py-1.5 rounded border transition-colors cursor-pointer ${
                            (draftAnnotation as any).positionPreset === pos
                              ? "bg-brand-clear text-white border-brand-clear"
                              : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                          }`}
                        >
                          {pos === "top" ? "Øverst" : pos === "center" ? "Midt" : "Nederst"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Størrelse</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["small", "normal", "large"] as const).map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setDraftAnnotation(prev => prev ? { ...prev, size: sz } : null)}
                          className={`text-xs font-medium py-1.5 rounded border transition-colors cursor-pointer ${
                            (draftAnnotation as any).size === sz
                              ? "bg-brand-clear text-white border-brand-clear"
                              : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                          }`}
                        >
                          {sz === "small" ? "Lille" : sz === "normal" ? "Normal" : "Stor"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(draftAnnotation.type === "circle" || draftAnnotation.type === "arrow") && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Markeringens farve</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["yellow", "red", "white"] as const).map((clr) => (
                        <button
                          key={clr}
                          onClick={() => setDraftAnnotation(prev => prev ? { ...prev, color: clr } : null)}
                          className={`text-xs font-medium py-1.5 rounded border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            (draftAnnotation as any).color === clr
                              ? "bg-brand-clear text-white border-brand-clear"
                              : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-slate-400"
                            style={{ backgroundColor: clr === "yellow" ? BRAND_COLORS.accent : clr === "red" ? BRAND_COLORS.error : "#FFFFFF" }}
                          />
                          <span>{clr === "yellow" ? "Gul" : clr === "red" ? "Rød" : "Hvid"}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {draftAnnotation.type === "circle" && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Stregtykkelse</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(["normal", "bold"] as const).map((thick) => (
                            <button
                              key={thick}
                              onClick={() => setDraftAnnotation(prev => prev ? { ...prev, thickness: thick } : null)}
                              className={`text-xs font-medium py-1.5 rounded border transition-colors cursor-pointer ${
                                (draftAnnotation as any).thickness === thick
                                  ? "bg-brand-clear text-white border-brand-clear"
                                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                              }`}
                            >
                              {thick === "normal" ? "Normal" : "Kraftig"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Størrelse (Radius)</label>
                        <input
                          type="range"
                          min="0.04"
                          max="0.25"
                          step="0.01"
                          value={(draftAnnotation as any).radius}
                          onChange={(e) => setDraftAnnotation(prev => prev ? { ...prev, radius: parseFloat(e.target.value) } : null)}
                          className="w-full accent-brand-clear"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Shared Duration options (excluding freeze) */}
              {draftAnnotation.type !== "freeze" && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Varighed på skærmen</label>
                  <div className="grid grid-cols-4 gap-1">
                    {([2, 3, 5, 999] as const).map((dur) => (
                      <button
                        key={dur}
                        onClick={() => {
                          const limitTime = dur === 999 ? endTime : Math.min(endTime, (draftAnnotation as any).startTime + dur);
                          setDraftAnnotation(prev => prev ? { ...prev, endTime: limitTime } : null);
                        }}
                        className={`text-[10px] font-semibold py-1.5 rounded border transition-colors cursor-pointer ${
                          (draftAnnotation as any).endTime - (draftAnnotation as any).startTime > 10
                            ? (dur === 999 ? "bg-brand-clear text-white border-brand-clear" : "bg-slate-50 text-slate-700 border-slate-200")
                            : (Math.round((draftAnnotation as any).endTime - (draftAnnotation as any).startTime) === dur ? "bg-brand-clear text-white border-brand-clear" : "bg-slate-50 text-slate-700 border-slate-200")
                        }`}
                      >
                        {dur === 999 ? "Resten" : `${dur}s`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm / Cancel actions */}
              <div className="grid grid-cols-2 gap-2.5 mt-2">
                <button
                  onClick={cancelDraftAnnotation}
                  className="py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Afbryd
                </button>
                <button
                  onClick={saveDraftAnnotation}
                  className="py-2 bg-brand-success hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {draftAnnotation.type === "text" ? "Tilføj tekst" : draftAnnotation.type === "circle" ? "Gem cirkel" : "Gem pil"}
                </button>
              </div>
            </div>
          ) : (
            /* Standard state: list of saved annotations */
            <div className="p-5 flex-1 flex flex-col min-h-0">
              <div className="mb-4">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-1">
                  Markeringsoverblik ({annotations.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Her ses alle dine tilføjede fokuspunkter på videoen. Klik på et punkt for at springe dertil.
                </p>
              </div>

              {annotations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white text-slate-400">
                  <Eye className="w-8 h-8 mb-2 opacity-50 text-slate-300" />
                  <p className="text-xs">Ingen markeringer endnu.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Brug værktøjerne for at forklare din taktik.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0 pr-1">
                  {annotations.map((anno) => (
                    <div
                      key={anno.id}
                      onClick={() => handleAnnotationSelect(anno)}
                      className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer group ${
                        selectedAnnotationId === anno.id
                          ? "bg-white border-brand-clear shadow-md"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          anno.type === "text" ? "bg-blue-50 text-blue-600" :
                          anno.type === "circle" ? "bg-amber-50 text-amber-600" :
                          anno.type === "arrow" ? "bg-purple-50 text-purple-600" :
                          "bg-indigo-50 text-indigo-600"
                        }`}>
                          {anno.type === "text" && <Type className="w-4 h-4" />}
                          {anno.type === "circle" && <Circle className="w-4 h-4" />}
                          {anno.type === "arrow" && <MoveUpRight className="w-4 h-4" />}
                          {anno.type === "freeze" && <Snowflake className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 capitalize leading-none mb-1">
                            {anno.type === "text" ? "Tekst" : anno.type === "circle" ? "Cirkel" : anno.type === "arrow" ? "Pil" : "Frys"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {anno.type === "freeze" 
                              ? `Frys ved ${formatFreezeTime(anno.time)} • ${anno.duration}s`
                              : `${formatTimeRange(anno.startTime, anno.endTime)}`
                            }
                          </p>
                          {anno.type === "text" && (
                            <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[130px] italic">
                              "{anno.text}"
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAnnotation(anno.id);
                        }}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-brand-error rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Slet markering"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
