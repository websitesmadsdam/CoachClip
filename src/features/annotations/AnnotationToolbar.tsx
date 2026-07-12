/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Type, Circle, MoveUpRight, Snowflake, Undo } from "lucide-react";

interface AnnotationToolbarProps {
  activeTool: "text" | "circle" | "arrow" | "freeze" | null;
  onSelectTool: (tool: "text" | "circle" | "arrow" | "freeze" | null) => void;
  onUndo: () => void;
  onAddFreeze: () => void;
  hasAnnotations: boolean;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  onSelectTool,
  onUndo,
  onAddFreeze,
  hasAnnotations,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider mb-1">
          Vælg tegneværktøj
        </h3>
        <p className="text-[10px] text-slate-500">
          Vælg et værktøj og klik derefter direkte på videoen for at placere det.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {/* Text Tool */}
        <button
          onClick={() => onSelectTool(activeTool === "text" ? null : "text")}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeTool === "text"
              ? "bg-brand-clear/10 border-brand-clear text-brand-clear shadow-sm font-bold scale-101"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
          }`}
        >
          <Type className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm leading-none font-bold">Tilføj tekst</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Indtast en forklaring på banen</p>
          </div>
        </button>

        {/* Circle Tool */}
        <button
          onClick={() => onSelectTool(activeTool === "circle" ? null : "circle")}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeTool === "circle"
              ? "bg-brand-clear/10 border-brand-clear text-brand-clear shadow-sm font-bold scale-101"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
          }`}
        >
          <Circle className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm leading-none font-bold">Marker spiller</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Placer en gul cirkel på videoen</p>
          </div>
        </button>

        {/* Arrow Tool */}
        <button
          onClick={() => onSelectTool(activeTool === "arrow" ? null : "arrow")}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeTool === "arrow"
              ? "bg-brand-clear/10 border-brand-clear text-brand-clear shadow-sm font-bold scale-101"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
          }`}
        >
          <MoveUpRight className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm leading-none font-bold">Vis bevægelse</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Tegn en gul pil på banen</p>
          </div>
        </button>

        {/* Freeze Frame Tool */}
        <button
          onClick={onAddFreeze}
          className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer bg-white border-slate-200 hover:border-slate-300 text-slate-700"
        >
          <Snowflake className="w-5 h-5 shrink-0 text-sky-500" />
          <div>
            <p className="text-sm leading-none font-bold">Frys billede</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Sæt videoen på pause i et øjeblik</p>
          </div>
        </button>
      </div>

      {/* Undo Button */}
      {hasAnnotations && (
        <button
          onClick={onUndo}
          className="mt-2 w-full py-2.5 px-3 bg-slate-150 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
        >
          <Undo className="w-3.5 h-3.5" />
          <span>Fortryd sidste tegning</span>
        </button>
      )}
    </div>
  );
};
