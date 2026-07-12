/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Upload, Film, ChevronRight, ArrowLeft, AlertCircle, Sparkles } from "lucide-react";

interface VideoSelectScreenProps {
  onFileSelected: (file: File) => void;
  onUseStockVideo: () => void;
  onBack: () => void;
  selectedFile: File | null;
  onAccept: () => void;
}

export const VideoSelectScreen: React.FC<VideoSelectScreenProps> = ({
  onFileSelected,
  onUseStockVideo,
  onBack,
  selectedFile,
  onAccept,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm animate-scale-up">
      {/* Navigation top */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 cursor-pointer"
          title="Tilbage til forsiden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-xl font-black text-brand-dark">Vælg kamp- eller træningsvideo</h3>
          <p className="text-xs text-slate-400">Vælg den lokale videofil på din enhed, som du vil klippe og analysere.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Main interactive Dropzone file picker container */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden group select-none ${
            isDragOver
              ? "border-brand-clear bg-blue-50/50 scale-[0.99] shadow-inner"
              : selectedFile
              ? "border-green-400 bg-green-50/20"
              : "border-slate-200 bg-slate-50 hover:bg-slate-100/50 hover:border-slate-300"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {selectedFile ? (
            <>
              <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4 border border-green-100 shadow-sm">
                <Film className="w-7 h-7" />
              </div>
              <p className="text-sm font-extrabold text-slate-800 leading-none">Video klar til analyse!</p>
              <p className="text-xs text-green-600 font-mono font-bold mt-1.5">{selectedFile.name}</p>
              <p className="text-[10px] text-slate-400 mt-1">Størrelse: {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              <span className="mt-4 inline-block text-xs font-black text-brand-clear hover:underline">
                Klik for at vælge en anden fil
              </span>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-blue-50 text-brand-clear rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-sm group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-sm font-extrabold text-slate-800 leading-none">Klik eller træk video herhen</p>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Understøtter de fleste formater som MP4, MOV og WebM. <br />
                Din video forlader <strong className="text-slate-600">aldrig</strong> din enhed og gemmes helt lokalt.
              </p>
            </>
          )}
        </div>

        {/* Option to try default basketball clip */}
        {!selectedFile && (
          <div className="flex flex-col gap-2.5">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eller prøv med det samme</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              onClick={onUseStockVideo}
              className="w-full p-4 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/50 rounded-2xl flex items-center justify-between text-left transition-all hover:shadow-sm cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Prøv en demo basketball-video</p>
                  <p className="text-[10px] text-amber-600 font-medium">Uden at uploade din egen fil • Klik for at teste med det samme</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}

        {/* Error/Notice bar */}
        <div className="flex gap-2.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-500 leading-normal">
          <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Lager-venlig teknologi:</strong> For at beskytte din telefons hukommelse overfører CoachClip ikke tunge rå-videoer til vores server. Det hele afspilles og analyseres direkte i din browser ved brug af HTML5-teknologi.
          </span>
        </div>

        {/* Proceed Action Button */}
        {selectedFile && (
          <button
            onClick={onAccept}
            className="w-full mt-2 py-4 bg-brand-clear hover:bg-blue-600 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-clear/15 hover:shadow-blue-500/20 active:scale-99 transition-all"
          >
            <span>Fortsæt til klip-trimning</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
