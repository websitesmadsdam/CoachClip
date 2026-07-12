/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Annotation } from "../../types";
import { Type, Circle, MoveUpRight, Snowflake, Trash2, Eye } from "lucide-react";
import { formatPreciseTime } from "../../utils/videoUtils";

interface AnnotationListProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (anno: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  startTime: number;
}

export const AnnotationList: React.FC<AnnotationListProps> = (props) => {
  const {
    annotations,
    selectedAnnotationId,
    onSelectAnnotation,
    onDeleteAnnotation,
  } = props;
  const formatTimeRangeLocal = (start: number, end: number) => {
    return `${formatPreciseTime(start)} – ${formatPreciseTime(end)}`;
  };

  return (
    <div className="p-5 flex-1 flex flex-col min-h-0">
      <div className="mb-4">
        <h3 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider mb-1">
          Markeringsoverblik ({annotations.length})
        </h3>
        <p className="text-[11px] text-slate-500">
          Her ses alle dine tilføjede fokuspunkter på videoen. Klik på et punkt for at springe dertil.
        </p>
      </div>

      {annotations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white text-slate-400">
          <Eye className="w-8 h-8 mb-2 opacity-50 text-slate-300" />
          <p className="text-xs font-bold text-slate-600">Ingen markeringer endnu.</p>
          <p className="text-[10px] text-slate-400 mt-1">Brug værktøjerne til at forklare din taktik.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0 pr-1">
          {annotations.map((anno) => (
            <div
              key={anno.id}
              onClick={() => onSelectAnnotation(anno)}
              className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer group ${
                selectedAnnotationId === anno.id
                  ? "bg-white border-brand-clear shadow-md ring-1 ring-brand-clear/30"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    anno.type === "text"
                      ? "bg-blue-50 text-blue-600"
                      : anno.type === "circle"
                      ? "bg-amber-50 text-amber-600"
                      : anno.type === "arrow"
                      ? "bg-purple-50 text-purple-600"
                      : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  {anno.type === "text" && <Type className="w-4 h-4" />}
                  {anno.type === "circle" && <Circle className="w-4 h-4" />}
                  {anno.type === "arrow" && <MoveUpRight className="w-4 h-4" />}
                  {anno.type === "freeze" && <Snowflake className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 leading-none mb-1">
                    {anno.type === "text"
                      ? "Tekstkommentar"
                      : anno.type === "circle"
                      ? "Spillermarkering"
                      : anno.type === "arrow"
                      ? "Bevægelsespil"
                      : "Fryseramme"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {anno.type === "freeze"
                      ? `Frys ved ${formatPreciseTime(anno.time)} • ${anno.duration}s`
                      : `${formatTimeRangeLocal(anno.startTime, anno.endTime)}`}
                  </p>
                  {anno.type === "text" && anno.text && (
                    <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[140px] italic">
                      "{anno.text}"
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteAnnotation(anno.id);
                }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Slet markering"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
