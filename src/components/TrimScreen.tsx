/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Check, ArrowLeft, FastForward } from "lucide-react";

interface TrimScreenProps {
  videoUrl: string;
  fileName: string;
  fileSize: number;
  videoDuration: number;
  onComplete: (startTime: number, endTime: number) => void;
  onBack: () => void;
}

export const TrimScreen: React.FC<TrimScreenProps> = ({
  videoUrl,
  fileName,
  fileSize,
  videoDuration,
  onComplete,
  onBack,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(videoDuration || 10);
  
  // Phase state: "find" (Screen 3) or "adjust" (Screen 4)
  const [phase, setPhase] = useState<"find" | "adjust">("find");

  // Format time utility (MM:SS.C)
  const formatPreciseTime = (sec: number) => {
    if (isNaN(sec) || sec === null) return "00:00.0";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ds = Math.floor((sec % 1) * 10);
    const mStr = m < 10 ? `0${m}` : `${m}`;
    const sStr = s < 10 ? `0${s}` : `${s}`;
    return `${mStr}:${sStr}.${ds}`;
  };

  // Keep track of playing state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Handle playback rate change
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Adjust timeupdate logic depending on phase
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    setCurrentTime(current);

    if (phase === "adjust") {
      // Loop within the selected range
      if (current >= endTime) {
        video.currentTime = startTime;
      } else if (current < startTime) {
        video.currentTime = startTime;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && !videoDuration) {
      // if not set, set it
      setEndTime(videoRef.current.duration);
    }
  };

  // Video controls
  const togglePlay = () => setIsPlaying(!isPlaying);

  const seekRelative = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    let target = video.currentTime + seconds;
    if (target < 0) target = 0;
    if (target > video.duration) target = video.duration;
    video.currentTime = target;
    setCurrentTime(target);
  };

  const setStartToCurrent = () => {
    const current = currentTime;
    if (current < endTime) {
      setStartTime(current);
    } else {
      setStartTime(current);
      setEndTime(Math.min(videoDuration, current + 5));
    }
  };

  const setEndToCurrent = () => {
    const current = currentTime;
    if (current > startTime) {
      setEndTime(current);
    } else {
      setEndTime(current);
      setStartTime(Math.max(0, current - 5));
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

  // Adjust buttons (Screen 4)
  const adjustStartTime = (amount: number) => {
    const newStart = Math.max(0, Math.min(endTime - 0.2, startTime + amount));
    setStartTime(newStart);
    if (videoRef.current) {
      videoRef.current.currentTime = newStart;
      setCurrentTime(newStart);
    }
  };

  const adjustEndTime = (amount: number) => {
    const newEnd = Math.min(videoDuration, Math.max(startTime + 0.2, endTime + amount));
    setEndTime(newEnd);
    if (videoRef.current) {
      videoRef.current.currentTime = newEnd - 0.5; // peek before end
      setCurrentTime(newEnd - 0.5);
    }
  };

  const handleProceed = () => {
    if (phase === "find") {
      setPhase("adjust");
      // Pause on transition and set position to start
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.currentTime = startTime;
        setCurrentTime(startTime);
      }
    } else {
      onComplete(startTime, endTime);
    }
  };

  const clipLength = endTime - startTime;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col h-full bg-brand-panel rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <button
            onClick={phase === "adjust" ? () => setPhase("find") : onBack}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600 cursor-pointer"
            title="Gå tilbage"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-brand-dark">
              {phase === "find" ? "Find situationen" : "Juster dit klip"}
            </h2>
            <p className="text-xs text-slate-500 max-w-md truncate">
              {phase === "find"
                ? "Sæt start- og sluttidspunkt for den vigtige spilsituation."
                : "Finjuster klippet præcist, før du tilføjer din analyse."}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="bg-brand-dark/10 text-brand-dark text-xs px-2.5 py-1 rounded-full font-medium">
            {phase === "find" ? "Trin 1 af 3: Trim" : "Trin 2 af 3: Finjuster"}
          </span>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto">
        {/* Video Area */}
        <div className="flex-1 bg-black flex flex-col justify-center relative min-h-[300px] lg:min-h-[450px]">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full max-h-[500px] object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            playsInline
            onClick={togglePlay}
          />
          
          {/* Quick overlay indicating fine-tuning loop */}
          {phase === "adjust" && (
            <div className="absolute top-4 left-4 bg-brand-accent text-brand-dark text-xs font-bold px-3 py-1.5 rounded-md shadow-md flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-brand-dark"></span>
              <span>Loop-tilstand aktiveret</span>
            </div>
          )}

          {/* Video Controls overlay bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex flex-col gap-2">
            {/* Timeline */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white font-mono shrink-0 w-12 text-right">
                {formatPreciseTime(currentTime)}
              </span>

              {/* Interactive track */}
              <div
                onClick={handleTimelineClick}
                className="flex-1 h-3 bg-white/30 hover:bg-white/40 rounded-full relative cursor-pointer group"
              >
                {/* Selected region highlight */}
                <div
                  className="absolute h-full bg-brand-clear/50 rounded-full"
                  style={{
                    left: `${(startTime / videoDuration) * 100}%`,
                    width: `${((endTime - startTime) / videoDuration) * 100}%`,
                  }}
                />

                {/* Playhead */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-brand-accent border-2 border-white rounded-full shadow shadow-black/50 z-10"
                  style={{ left: `calc(${(currentTime / videoDuration) * 100}% - 8px)` }}
                />

                {/* Start Marker Flag */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-green-500 z-1"
                  style={{ left: `${(startTime / videoDuration) * 100}%` }}
                >
                  <div className="absolute -top-4 -left-1 text-[9px] bg-green-500 text-white px-1 rounded">IN</div>
                </div>

                {/* End Marker Flag */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-red-500 z-1"
                  style={{ left: `${(endTime / videoDuration) * 100}%` }}
                >
                  <div className="absolute -top-4 -left-1 text-[9px] bg-red-500 text-white px-1 rounded">UT</div>
                </div>
              </div>

              <span className="text-xs text-white font-mono shrink-0 w-12">
                {formatPreciseTime(videoDuration)}
              </span>
            </div>

            {/* Playback action controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => seekRelative(-5)}
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                  title="5 sekunder tilbage"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="-mt-1 block text-[9px] font-bold text-center">-5s</span>
                </button>

                <button
                  onClick={togglePlay}
                  className="p-3 bg-brand-clear hover:bg-blue-600 active:scale-95 text-white rounded-full transition-all cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
                </button>

                <button
                  onClick={() => seekRelative(5)}
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                  title="5 sekunder frem"
                >
                  <FastForward className="w-5 h-5" />
                  <span className="-mt-1 block text-[9px] font-bold text-center">+5s</span>
                </button>
              </div>

              {/* Speed Controller */}
              <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-lg">
                <span className="text-[10px] text-white/70 px-1 font-semibold uppercase tracking-wider hidden sm:inline">Tempo:</span>
                {([0.5, 1, 1.5, 2] as const).map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                      playbackRate === rate
                        ? "bg-brand-accent text-brand-dark"
                        : "text-white hover:bg-white/15"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar & Parameters side */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 p-6 flex flex-col justify-between bg-slate-50">
          {phase === "find" ? (
            /* Screen 3 Sidebar Content */
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-1 uppercase tracking-wider">Tidsmarkører</h3>
                <p className="text-xs text-slate-500">Spil videoen og klik på knapperne for at isolere situationen.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={setStartToCurrent}
                  className="flex flex-col items-center justify-center p-4 bg-white border-2 border-green-200 hover:border-green-400 active:bg-green-50 rounded-xl transition-all cursor-pointer shadow-sm group"
                >
                  <span className="text-xs font-semibold text-green-700 uppercase mb-1">Sæt Start</span>
                  <span className="text-sm font-mono font-bold text-slate-800 bg-green-50 px-2 py-0.5 rounded group-hover:scale-105 transition-transform">
                    {formatPreciseTime(startTime)}
                  </span>
                </button>

                <button
                  onClick={setEndToCurrent}
                  className="flex flex-col items-center justify-center p-4 bg-white border-2 border-red-200 hover:border-red-400 active:bg-red-50 rounded-xl transition-all cursor-pointer shadow-sm group"
                >
                  <span className="text-xs font-semibold text-red-700 uppercase mb-1">Sæt Slut</span>
                  <span className="text-sm font-mono font-bold text-slate-800 bg-red-50 px-2 py-0.5 rounded group-hover:scale-105 transition-transform">
                    {formatPreciseTime(endTime)}
                  </span>
                </button>
              </div>

              <div className="bg-brand-dark/5 p-4 rounded-xl border border-brand-dark/10">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Samlet fil:</span>
                  <span className="font-semibold">{fileName}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 mb-2">
                  <span>Filstørrelse:</span>
                  <span className="font-semibold">{(fileSize / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <hr className="border-slate-200 my-2" />
                <div className="flex justify-between text-sm text-brand-dark">
                  <span className="font-medium">Klippets længde:</span>
                  <span className="font-mono font-bold text-brand-clear text-base">
                    {clipLength.toFixed(1)} sekunder
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Screen 4 Sidebar Content: Fine tuning controls */
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-1 uppercase tracking-wider">Finjuster klip</h3>
                <p className="text-xs text-slate-500">
                  Mikro-juster start og slut for det perfekte klip. Videoen looper automatisk.
                </p>
              </div>

              {/* Start Adjustment block */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-green-700 uppercase">Starttid</span>
                  <span className="font-mono text-sm font-bold bg-green-50 px-2 py-0.5 rounded text-green-800">
                    {formatPreciseTime(startTime)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => adjustStartTime(-1)}
                    className="text-xs font-medium py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    -1s
                  </button>
                  <button
                    onClick={() => adjustStartTime(-0.1)}
                    className="text-xs font-medium py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    -0.1
                  </button>
                  <button
                    onClick={() => adjustStartTime(0.1)}
                    className="text-xs font-medium py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    +0.1
                  </button>
                  <button
                    onClick={() => adjustStartTime(1)}
                    className="text-xs font-medium py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    +1s
                  </button>
                </div>
              </div>

              {/* End Adjustment block */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-red-700 uppercase">Sluttid</span>
                  <span className="font-mono text-sm font-bold bg-red-50 px-2 py-0.5 rounded text-red-800">
                    {formatPreciseTime(endTime)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => adjustEndTime(-1)}
                    className="text-xs font-medium py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    -1s
                  </button>
                  <button
                    onClick={() => adjustEndTime(-0.1)}
                    className="text-xs font-medium py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    -0.1
                  </button>
                  <button
                    onClick={() => adjustEndTime(0.1)}
                    className="text-xs font-medium py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    +0.1
                  </button>
                  <button
                    onClick={() => adjustEndTime(1)}
                    className="text-xs font-medium py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    +1s
                  </button>
                </div>
              </div>

              <div className="bg-brand-dark text-white p-4 rounded-xl shadow-inner text-center">
                <span className="text-xs text-white/60 block uppercase font-semibold">Analysevarighed</span>
                <span className="text-2xl font-bold font-mono text-brand-accent">
                  {clipLength.toFixed(1)}s
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 mt-6 lg:mt-0">
            {phase === "adjust" && (
              <button
                onClick={() => setPhase("find")}
                className="w-full py-2.5 px-4 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-800 font-medium text-sm transition-colors cursor-pointer"
              >
                Tilbage til hele videoen
              </button>
            )}

            <button
              onClick={handleProceed}
              className="w-full py-3.5 px-4 bg-brand-clear hover:bg-blue-600 active:scale-98 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-brand-clear/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{phase === "find" ? "Gå til finjustering" : "Klip er korrekt"}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
