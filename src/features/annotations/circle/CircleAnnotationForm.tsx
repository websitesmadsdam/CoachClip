/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CircleAnnotation } from "../../../types";
import { Trash2, Check, X } from "lucide-react";

interface CircleAnnotationFormProps {
  annotation: CircleAnnotation;
  onChange: (updated: CircleAnnotation) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  clipEndTime: number;
}

export const CircleAnnotationForm: React.FC<CircleAnnotationFormProps> = ({
  annotation,
  onChange,
  onSave,
  onCancel,
  onDelete,
  clipEndTime,
}) => {
  const duration = annotation.endTime - annotation.startTime;

  const handleDurationChange = (secs: number) => {
    onChange({
      ...annotation,
      endTime: Math.min(clipEndTime, annotation.startTime + secs),
    });
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-900 text-white p-4 rounded-xl border border-slate-800">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <span className="text-xs font-black uppercase tracking-wider text-amber-400">
          Marker spiller (Cirkel)
        </span>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1 text-red-400 hover:bg-slate-800 rounded-md transition-colors"
            title="Slet markering"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Color Selection */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Farve</label>
        <div className="flex gap-2">
          {([
            { id: "yellow", bg: "bg-yellow-400", label: "Gul" },
            { id: "red", bg: "bg-red-500", label: "Rød" },
            { id: "white", bg: "bg-white", label: "Hvid" },
          ] as const).map((c) => (
            <button
              key={c.id}
              onClick={() => onChange({ ...annotation, color: c.id })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                annotation.color === c.id
                  ? "border-amber-400 bg-slate-800"
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className={`w-3 h-3 rounded-full ${c.bg} shrink-0`} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Thickness / Style */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Stregtype</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onChange({ ...annotation, thickness: "normal" })}
            className={`py-1.5 rounded-lg text-xs font-semibold border ${
              annotation.thickness === "normal"
                ? "border-amber-400 bg-slate-800 text-white"
                : "border-slate-800 bg-slate-950 text-slate-400"
            }`}
          >
            Stiplet
          </button>
          <button
            onClick={() => onChange({ ...annotation, thickness: "bold" })}
            className={`py-1.5 rounded-lg text-xs font-semibold border ${
              annotation.thickness === "bold"
                ? "border-amber-400 bg-slate-800 text-white"
                : "border-slate-800 bg-slate-950 text-slate-400"
            }`}
          >
            Fuldt optrukket
          </button>
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Varighed</label>
        <div className="grid grid-cols-3 gap-1.5">
          {([2, 3, 5] as const).map((secs) => {
            const isActive = Math.abs(duration - secs) < 0.2;
            return (
              <button
                key={secs}
                onClick={() => handleDurationChange(secs)}
                className={`py-1.5 text-xs font-mono font-bold rounded-lg border ${
                  isActive
                    ? "border-amber-400 bg-slate-800 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                {secs}s
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 border-t border-slate-800 pt-3 mt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-900 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          Annuller
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          Gem
        </button>
      </div>
    </div>
  );
};
