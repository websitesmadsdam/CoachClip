/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import { formatPreciseTime, clampTime } from "../utils/videoUtils";

interface ClipFineTuneScreenProps {
  videoUrl: string;
  videoDuration: number;
  initialStartTime: number;
  initialEndTime: number;
  onBack: () => void;
  onProceed: (startTime: number, endTime: number) => void;
}

export const ClipFineTuneScreen: React.FC<ClipFineTuneScreenProps> = ({
  videoUrl,
  videoDuration,
  initialStartTime,
  initialEndTime,
  onBack,
  onProceed,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(initialStartTime);
  const [startTime, setStartTime] = useState<number>(initialStartTime);
  const [endTime, setEndTime] = useState<number>(initialEndTime);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Auto-loop checking using standard requestAnimationFrame for high precision
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId: number;

    const checkLoop = () => {
      const current = video.currentTime;
      setCurrentTime(current);

      if (current >= endTime || current < startTime) {
        video.currentTime = startTime;
        setCurrentTime(startTime);
      }

      if (isPlaying) {
        rafId = requestAnimationFrame(checkLoop);
      }
    };

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
      rafId = requestAnimationFrame(checkLoop);
    } else {
      video.pause();
    }

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, startTime, endTime]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const adjustStartTime = (amount: number) => {
    // Keep 1s minimum duration
    const target = clampTime(startTime + amount, endTime - 1.0, 0);
    setStartTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const adjustEndTime = (amount: number) => {
    // Keep 1s minimum duration
    const target = clampTime(endTime + amount, videoDuration, startTime + 1.0);
    setEndTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(startTime, target - 0.5); // Peek end
      setCurrentTime(videoRef.current.currentTime);
    }
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
            <h2 className="text-base sm:text-lg font-black text-brand-dark">Finjuster dit klip</h2>
            <p className="text-xs text-slate-500">Mikro-juster start- og sluttider for det perfekte klip. Videoen looper automatisk.</p>
          </div>
        </div>
        <div className="text-right">
          <span className="bg-brand-dark/10 text-brand-dark text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            Trin 2 af 3: Juster
          </span>
        </div>
      </div>

      {/* Main split */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto">
        {/* Video Screen Area */}
        <div className="flex-1 bg-black flex flex-col justify-center relative min-h-[280px] lg:min-h-[440px]">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full max-h-[480px] object-contain pointer-events-none"
            playsInline
          />

          <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} />

          {/* Active Loop mode banner indicator */}
          <div className="absolute top-4 left-4 bg-amber-400 text-slate-900 text-[10px] font-black px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 animate-pulse z-20">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="uppercase tracking-wider">Loop-tilstand aktiveret</span>
          </div>

          {/* Controls bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 flex flex-col gap-2 z-20">
            <div className="flex items-center justify-between">
              <button
                onClick={togglePlay}
                className="p-3 bg-brand-clear hover:bg-blue-600 text-white rounded-full transition-transform active:scale-95 cursor-pointer shadow"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white text-white" /> : <Play className="w-5 h-5 fill-white text-white" />}
              </button>

              <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-xl text-white">
                <span className="text-[9px] font-black uppercase text-white/50 px-1">Fart:</span>
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

              <span className="font-mono text-xs font-bold text-white bg-slate-900/60 border border-white/10 px-2.5 py-1 rounded">
                Looping: {formatPreciseTime(startTime)} – {formatPreciseTime(endTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Adjustments sidebar panel */}
        <div className="w-full lg:w-80 p-6 flex flex-col justify-between bg-slate-50 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200">
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider mb-1">Præcisions-tuning</h3>
              <p className="text-xs text-slate-500">
                Finjuster klippet i intervaller på 1 sekund eller en tiendedel sekund.
              </p>
            </div>

            {/* Adjust start */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[10px] font-black text-green-700 uppercase tracking-wider">Starttid</span>
                <span className="font-mono text-xs font-bold bg-green-50 text-green-800 px-2 py-0.5 rounded">
                  {formatPreciseTime(startTime)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => adjustStartTime(-1)}
                  className="text-[10px] font-black py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  title="1 sekund tilbage"
                >
                  -1s
                </button>
                <button
                  onClick={() => adjustStartTime(-0.1)}
                  className="text-[10px] font-black py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  title="0.1 sekund tilbage"
                >
                  -0.1s
                </button>
                <button
                  onClick={() => adjustStartTime(0.1)}
                  className="text-[10px] font-black py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  title="0.1 sekund frem"
                >
                  +0.1s
                </button>
                <button
                  onClick={() => adjustStartTime(1)}
                  className="text-[10px] font-black py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  title="1 sekund frem"
                >
                  +1s
                </button>
              </div>
            </div>

            {/* Adjust end */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[10px] font-black text-red-700 uppercase tracking-wider">Sluttid</span>
                <span className="font-mono text-xs font-bold bg-red-50 text-red-800 px-2 py-0.5 rounded">
                  {formatPreciseTime(endTime)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => adjustEndTime(-1)}
                  className="text-[10px] font-black py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  title="1 sekund tilbage"
                >
                  -1s
                </button>
                <button
                  onClick={() => adjustEndTime(-0.1)}
                  className="text-[10px] font-black py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  title="0.1 sekund tilbage"
                >
                  -0.1s
                </button>
                <button
                  onClick={() => adjustEndTime(0.1)}
                  className="text-[10px] font-black py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  title="0.1 sekund frem"
                >
                  +0.1s
                </button>
                <button
                  onClick={() => adjustEndTime(1)}
                  className="text-[10px] font-black py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  title="1 sekund frem"
                >
                  +1s
                </button>
              </div>
            </div>

            {/* Total Duration Info */}
            <div className="bg-brand-dark text-white p-4 rounded-2xl text-center shadow-inner">
              <span className="text-[9px] text-white/50 block uppercase font-bold tracking-wider mb-0.5">Samlet klip-længde</span>
              <span className="text-xl font-mono font-black text-brand-accent">{clipLength.toFixed(1)}s</span>
            </div>
          </div>

          {/* Action trigger button */}
          <button
            onClick={() => onProceed(startTime, endTime)}
            className="w-full mt-6 py-4 bg-brand-clear hover:bg-blue-600 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-clear/15"
          >
            <span>Klip er korrekt: Tegn</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
