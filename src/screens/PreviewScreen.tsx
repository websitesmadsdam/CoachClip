/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: PreviewScreen maps untyped sub-annotation attributes with any.
 */

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, X, Edit, RotateCcw } from "lucide-react";
import { CoachClipProject } from "../types";
import { formatPreciseTime } from "../utils/videoUtils";

interface PreviewScreenProps {
  project: CoachClipProject;
  onClose: () => void;
  onEdit: () => void;
  videoUrl: string;
}

export const PreviewScreen: React.FC<PreviewScreenProps> = ({
  project,
  onClose,
  onEdit,
  videoUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(project.clip.startTime);

  // Sync starting time
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = project.clip.startTime;
      setCurrentTime(project.clip.startTime);
    }
  }, [project, videoUrl]);

  // Handle play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    setCurrentTime(current);

    // Loop clip preview
    if (current >= project.clip.endTime || current < project.clip.startTime) {
      video.currentTime = project.clip.startTime;
      setCurrentTime(project.clip.startTime);
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const seekRelative = (secs: number) => {
    const video = videoRef.current;
    if (!video) return;
    let target = video.currentTime + secs;
    if (target < project.clip.startTime) target = project.clip.startTime;
    if (target > project.clip.endTime) target = project.clip.endTime;
    video.currentTime = target;
    setCurrentTime(target);
  };

  // Filter annotations valid at this preview time
  const activeAnnotations = project.annotations.filter(
    (a) => currentTime >= a.startTime && currentTime <= a.endTime
  );

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col border border-slate-800 animate-scale-up">
        
        {/* Header bar */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <h4 className="font-extrabold text-white text-base leading-tight">
              Gennemse: {project.title}
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
              {project.category || "Ingen kategori"} •{" "}
              {project.feedbackType === "positive" ? "✓ Positvt eksempel" : "⚠ Udviklingspunkt"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-850 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Luk afspiller"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Sandbox Arena */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain pointer-events-none"
            onTimeUpdate={handleTimeUpdate}
            playsInline
            autoPlay
            muted
          />

          {/* Click to play/pause hit region */}
          <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} />

          {/* Read-Only Overlays synchronized perfectly */}
          <div className="absolute inset-0 pointer-events-none select-none z-20">
            {/* SVG Layer for Arrows */}
            <svg className="w-full h-full absolute inset-0">
              <defs>
                <marker
                  id="arrow-pre-yellow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#FFB020" />
                </marker>
                <marker
                  id="arrow-pre-red"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#D64545" />
                </marker>
                <marker
                  id="arrow-pre-white"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#FFFFFF" />
                </marker>
              </defs>

              {activeAnnotations
                .filter((a) => a.type === "arrow")
                .map((arrow: any) => (
                  <line
                    key={arrow.id}
                    x1={`${arrow.startX * 100}%`}
                    y1={`${arrow.startY * 100}%`}
                    x2={`${arrow.endX * 100}%`}
                    y2={`${arrow.endY * 100}%`}
                    stroke={
                      arrow.color === "yellow"
                        ? "#FFB020"
                        : arrow.color === "red"
                        ? "#D64545"
                        : "#FFFFFF"
                    }
                    strokeWidth="4"
                    markerEnd={`url(#arrow-pre-${arrow.color})`}
                  />
                ))}
            </svg>

            {/* Circles Layer */}
            {activeAnnotations
              .filter((a) => a.type === "circle")
              .map((circle: any) => (
                <div
                  key={circle.id}
                  className="absolute rounded-full border-4"
                  style={{
                    left: `${circle.x * 100}%`,
                    top: `${circle.y * 100}%`,
                    width: `${circle.radius * 200}%`,
                    height: `${circle.radius * 200}%`,
                    transform: "translate(-50%, -50%)",
                    borderColor:
                      circle.color === "yellow"
                        ? "#FFB020"
                        : circle.color === "red"
                        ? "#D64545"
                        : "#FFFFFF",
                    borderStyle: circle.thickness === "bold" ? "solid" : "dashed",
                    backgroundColor: "rgba(255, 176, 32, 0.05)",
                  }}
                />
              ))}

            {/* Texts Layer */}
            {activeAnnotations
              .filter((a) => a.type === "text")
              .map((text: any) => (
                <div
                  key={text.id}
                  className="absolute px-3 py-1.5 rounded-lg text-white font-semibold bg-black/80 text-center max-w-[220px]"
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

        {/* Video controls bottom bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => seekRelative(-2)}
              className="p-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="2s tilbage"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className="p-2 bg-brand-clear hover:bg-blue-600 rounded-full text-white cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>
          </div>

          <div className="flex-1 h-2 bg-slate-850 rounded-full overflow-hidden relative">
            <div
              className="absolute h-full bg-brand-clear"
              style={{
                left: 0,
                width: `${
                  ((currentTime - project.clip.startTime) /
                    (project.clip.endTime - project.clip.startTime)) *
                  100
                }%`,
              }}
            />
          </div>

          <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-900 px-2 py-1 rounded-md shrink-0">
            {formatPreciseTime(currentTime)}
          </span>
        </div>

        {/* Footer controls */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            Luk afspiller
          </button>
          <button
            onClick={onEdit}
            className="px-6 py-2.5 bg-brand-clear hover:bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Rediger klip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
