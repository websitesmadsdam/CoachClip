/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, ChevronRight, ArrowLeft, FastForward, Film } from "lucide-react";
import { formatPreciseTime, clampTime } from "../utils/videoUtils";

interface ClipSelectScreenProps {
  videoUrl: string;
  fileName: string;
  fileSize: number;
  videoDuration: number;
  initialStartTime?: number;
  initialEndTime?: number;
  onBack: () => void;
  onProceed: (startTime: number, endTime: number) => void;
}

export const ClipSelectScreen: React.FC<ClipSelectScreenProps> = ({
  videoUrl,
  fileName,
  fileSize,
  videoDuration,
  initialStartTime = 0,
  initialEndTime,
  onBack,
  onProceed,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [startTime, setStartTime] = useState<number>(initialStartTime);
  const [endTime, setEndTime] = useState<number>(initialEndTime || videoDuration || 10);

  // Keep track of play state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && !initialEndTime) {
      setEndTime(videoRef.current.duration);
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const seekRelative = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = clampTime(video.currentTime + seconds, videoDuration, 0);
    video.currentTime = target;
    setCurrentTime(target);
  };

  const setStartToCurrent = () => {
    if (currentTime < endTime - 1.0) {
      setStartTime(currentTime);
    } else {
      // Keep 1s minimum distance
      setStartTime(currentTime);
      setEndTime(Math.min(videoDuration, currentTime + 1.0));
    }
  };

  const setEndToCurrent = () => {
    if (currentTime > startTime + 1.0) {
      setEndTime(currentTime);
    } else {
      // Keep 1s minimum distance
      setEndTime(currentTime);
      setStartTime(Math.max(0, currentTime - 1.0));
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTime = percentage * videoDuration;
    
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleProceedClick = () => {
    setIsPlaying(false);
    onProceed(startTime, endTime);
  };

  const clipLength = endTime - startTime;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col h-full bg-slate-50 border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-scale-up">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-600 cursor-pointer"
            title="Gå tilbage"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black text-brand-dark">Find situationen</h2>
            <p className="text-xs text-slate-500">Sæt start- og sluttidspunkt for den vigtige spilsituation.</p>
          </div>
        </div>
        <div className="text-right">
          <span className="bg-brand-dark/10 text-brand-dark text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            Trin 1 af 3: Klip
          </span>
        </div>
      </div>

      {/* Main Content splits left/right */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto">
        {/* Video Player */}
        <div className="flex-1 bg-black flex flex-col justify-center relative min-h-[280px] lg:min-h-[440px]">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full max-h-[480px] object-contain pointer-events-none"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            playsInline
          />
          
          <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} />

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col gap-3 z-20">
            {/* Timeline track */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-white font-mono shrink-0 w-12 text-right">
                {formatPreciseTime(currentTime)}
              </span>

              <div
                onClick={handleTimelineClick}
                className="flex-1 h-3.5 bg-white/20 hover:bg-white/30 rounded-full relative cursor-pointer"
              >
                {/* Selected slice highlight */}
                <div
                  className="absolute h-full bg-brand-clear/40 rounded-full"
                  style={{
                    left: `${(startTime / videoDuration) * 100}%`,
                    width: `${((endTime - startTime) / videoDuration) * 100}%`,
                  }}
                />

                {/* Cursor playhead */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-brand-accent border-2 border-white rounded-full shadow-lg z-10 pointer-events-none"
                  style={{ left: `calc(${(currentTime / videoDuration) * 100}% - 8px)` }}
                />

                {/* IN marker Flag */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-green-500 z-1"
                  style={{ left: `${(startTime / videoDuration) * 100}%` }}
                >
                  <div className="absolute -top-4 -left-1 text-[8px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded uppercase leading-none shadow">IN</div>
                </div>

                {/* OUT marker Flag */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-1"
                  style={{ left: `${(endTime / videoDuration) * 100}%` }}
                >
                  <div className="absolute -top-4 -left-1.5 text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase leading-none shadow">OUT</div>
                </div>
              </div>

              <span className="text-xs text-white font-mono shrink-0 w-12 text-left">
                {formatPreciseTime(videoDuration)}
              </span>
            </div>

            {/* Bottom playback buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => seekRelative(-5)}
                  className="p-1.5 text-white hover:bg-white/20 rounded-lg cursor-pointer"
                  title="5 sekunder tilbage"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-[8px] font-bold block text-center mt-0.5">-5s</span>
                </button>

                <button
                  onClick={togglePlay}
                  className="p-2.5 bg-brand-clear hover:bg-blue-600 text-white rounded-full transition-transform active:scale-95 cursor-pointer shadow"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white text-white" /> : <Play className="w-5 h-5 fill-white text-white" />}
                </button>

                <button
                  onClick={() => seekRelative(5)}
                  className="p-1.5 text-white hover:bg-white/20 rounded-lg cursor-pointer"
                  title="5 sekunder frem"
                >
                  <FastForward className="w-5 h-5" />
                  <span className="text-[8px] font-bold block text-center mt-0.5">+5s</span>
                </button>
              </div>

              {/* Tempo slider */}
              <div className="flex items-center gap-1 bg-white/10 p-1.5 rounded-xl text-white">
                <span className="text-[9px] font-black uppercase text-white/50 px-1 hidden sm:inline">Tempo:</span>
                {([0.5, 1, 2] as const).map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md cursor-pointer ${
                      playbackRate === rate ? "bg-brand-accent text-brand-dark" : "hover:bg-white/10"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Parameters selection */}
        <div className="w-full lg:w-80 p-6 flex flex-col justify-between bg-slate-50 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200">
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider mb-1">Isoler situation</h3>
              <p className="text-xs text-slate-500">
                Afspil videoen til det rigtige tidspunkt, og tryk på knapperne for at markere starten og slutningen af klippet.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <button
                onClick={setStartToCurrent}
                className="flex flex-col items-center justify-center p-4 bg-white border-2 border-green-200 hover:border-green-300 active:bg-green-50/50 rounded-2xl transition-all shadow-xs group cursor-pointer"
              >
                <span className="text-[10px] font-black text-green-700 uppercase tracking-wider mb-1">Sæt Start</span>
                <span className="text-xs font-mono font-bold text-slate-800 bg-green-50 px-2 py-0.5 rounded group-hover:scale-105 transition-transform">
                  {formatPreciseTime(startTime)}
                </span>
              </button>

              <button
                onClick={setEndToCurrent}
                className="flex flex-col items-center justify-center p-4 bg-white border-2 border-red-200 hover:border-red-300 active:bg-red-50/50 rounded-2xl transition-all shadow-xs group cursor-pointer"
              >
                <span className="text-[10px] font-black text-red-700 uppercase tracking-wider mb-1">Sæt Slut</span>
                <span className="text-xs font-mono font-bold text-slate-800 bg-red-50 px-2 py-0.5 rounded group-hover:scale-105 transition-transform">
                  {formatPreciseTime(endTime)}
                </span>
              </button>
            </div>

            <div className="bg-slate-200/40 border border-slate-200/60 p-4 rounded-2xl">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Kildefil:</span>
                <span className="font-bold text-slate-700 truncate max-w-[120px]" title={fileName}>{fileName}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mb-2">
                <span>Filstørrelse:</span>
                <span className="font-bold text-slate-700">{(fileSize / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <hr className="border-slate-200 my-2" />
              <div className="flex justify-between items-end text-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase leading-none mb-0.5">Kliplængde:</span>
                <span className="font-mono font-black text-brand-clear text-lg leading-none">
                  {clipLength.toFixed(1)}s
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleProceedClick}
            className="w-full mt-6 py-4 bg-brand-clear hover:bg-blue-600 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-clear/15"
          >
            <span>Næste: Finjustering</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
