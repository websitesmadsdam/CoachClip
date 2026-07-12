/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Film, Play, Trash2, Edit, Copy, Plus } from "lucide-react";
import { CoachClipProject } from "../types";

interface ProjectLibraryScreenProps {
  projects: CoachClipProject[];
  onSelectProject: (proj: CoachClipProject) => void;
  onOpenPreview: (proj: CoachClipProject) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (proj: CoachClipProject) => void;
  onOpenRenameModal: (id: string, currentTitle: string) => void;
  onNewClip: () => void;
}

export const ProjectLibraryScreen: React.FC<ProjectLibraryScreenProps> = ({
  projects,
  onSelectProject,
  onOpenPreview,
  onDeleteProject,
  onDuplicateProject,
  onOpenRenameModal,
  onNewClip,
}) => {
  const [filter, setFilter] = useState<string>("all");

  const getFilteredProjects = () => {
    return projects.filter((proj) => {
      const isExported = (proj.export?.status === "exported" || proj.exportStatus === "exported") && 
        !(proj.export?.status === "expired" || (proj.export?.expiresAt && new Date(proj.export.expiresAt) < new Date()));
      if (filter === "all") return true;
      if (filter === "exported") return isExported;
      if (filter === "not_exported") return !isExported;
      if (filter === "positive") return proj.feedbackType === "positive";
      if (filter === "development") return proj.feedbackType === "development";
      return true;
    });
  };

  const filtered = getFilteredProjects();

  const filterTabs = [
    { id: "all", label: "Alle" },
    { id: "exported", label: "Eksporteret" },
    { id: "not_exported", label: "Ikke eksporteret" },
    { id: "positive", label: "Positive eksempler" },
    { id: "development", label: "Udviklingspunkter" },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-brand-dark">Mine projekter</h2>
          <p className="text-xs text-slate-500 font-medium">Filtrer, kopier, omdøb eller fortsæt redigeringen af dine taktikklip.</p>
        </div>

        <button
          onClick={onNewClip}
          className="bg-brand-clear hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Opret nyt klip</span>
        </button>
      </div>

      {/* Filter Tabs Row */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl self-start">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              filter === tab.id
                ? "bg-brand-clear text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200/80 rounded-3xl bg-white max-w-lg mx-auto w-full flex flex-col items-center justify-center">
          <Film className="w-12 h-12 mx-auto mb-2 text-slate-300 opacity-60" />
          <p className="text-sm font-extrabold text-slate-700">Ingen projekter matcher filteret</p>
          <p className="text-xs text-slate-400 mt-1">Prøv et andet filter eller start et nyt analyseklip med det samme.</p>
          <button
            onClick={onNewClip}
            className="mt-5 py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-xl transition-all cursor-pointer border border-slate-200"
          >
            Lav dit første klip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((proj) => {
            const len = proj.clip.endTime - proj.clip.startTime;

            return (
              <div
                key={proj.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group cursor-pointer"
                onClick={() => onSelectProject(proj)}
              >
                <div>
                  <div className="aspect-video w-full rounded-xl bg-slate-950 overflow-hidden mb-3.5 relative flex items-center justify-center">
                    <Film className="w-8 h-8 text-slate-700 group-hover:scale-110 transition-transform" />
                    <span className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded font-mono text-[10px] text-white">
                      {len.toFixed(1)}s
                    </span>

                    {proj.feedbackType && (
                      <span
                        className={`absolute top-2 left-2 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          proj.feedbackType === "positive"
                            ? "bg-brand-success/20 text-brand-success border border-brand-success/25"
                            : "bg-brand-error/20 text-brand-error border border-brand-error/25"
                        }`}
                      >
                        {proj.feedbackType === "positive" ? "Positivt eksempel" : "Udviklingspunkt"}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-start gap-1">
                    <h4 className="font-extrabold text-slate-800 text-sm truncate max-w-[170px] leading-tight mb-1" title={proj.title}>
                      {proj.title}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRenameModal(proj.id, proj.title);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Omdøb"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      {proj.category || "Uden kat."}
                    </span>
                    <span className="text-[9px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded font-mono truncate max-w-[120px]">
                      {proj.sourceVideo.fileName}
                    </span>
                  </div>

                  {proj.export?.status === "expired" || (proj.export?.expiresAt && new Date(proj.export.expiresAt) < new Date()) ? (
                    <div className="mt-3.5 bg-red-50 border border-red-100/50 text-brand-error p-3 rounded-xl text-[11px] font-semibold leading-relaxed">
                      Eksportfilen er udløbet. Eksportér projektet igen for at oprette en ny videofil.
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-100">
                  {(() => {
                    const isExpired = proj.export?.status === "expired" || 
                      (proj.export?.expiresAt && new Date(proj.export.expiresAt) < new Date());
                    const isExported = proj.export?.status === "exported" || proj.exportStatus === "exported";

                    return (
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isExpired
                            ? "bg-red-50 text-brand-error"
                            : isExported
                            ? "bg-green-50 text-brand-success"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {isExpired ? "Udløbet" : isExported ? "Eksporteret" : "Ikke eksporteret"}
                      </span>
                    );
                  })()}

                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPreview(proj);
                      }}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-brand-clear rounded-lg cursor-pointer transition-colors"
                      title="Gennemse"
                    >
                      <Play className="w-4 h-4 fill-brand-clear" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateProject(proj);
                      }}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer transition-colors"
                      title="Kopier"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(proj.id);
                      }}
                      className="p-1.5 bg-slate-50 hover:bg-red-50 text-brand-error rounded-lg cursor-pointer transition-colors"
                      title="Slet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
