/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { FreezeAnnotation } from "../../../types";
import { Trash2, Check, X } from "lucide-react";
import { formatPreciseTime } from "../../../utils/videoUtils";

interface FreezeAnnotationFormProps {
  annotation: FreezeAnnotation;
  onChange: (updated: FreezeAnnotation) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export const FreezeAnnotationForm: React.FC<FreezeAnnotationFormProps> = ({
  annotation,
  onChange,
  onSave,
  onCancel,
  onDelete,
}) => {
  return (
    <div className="flex flex-col gap-4 bg-slate-900 text-white p-4 rounded-xl border border-slate-800">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <span className="text-xs font-black uppercase tracking-wider text-amber-400">
          Frys billede
        </span>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1 text-red-400 hover:bg-slate-800 rounded-md transition-colors"
            title="Slet frysepunkt"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="text-xs text-slate-400 leading-relaxed">
        Sætter afspilningen på pause ved <strong className="text-white">{formatPreciseTime(annotation.time)}</strong>, så du kan nå at tegne eller forklare situationen.
      </div>

      {/* Duration Selector */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Frysevarighed</label>
        <div className="grid grid-cols-3 gap-1.5">
          {([2, 3, 5] as const).map((secs) => {
            const isActive = annotation.duration === secs;
            return (
              <button
                key={secs}
                onClick={() => onChange({ ...annotation, duration: secs })}
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
