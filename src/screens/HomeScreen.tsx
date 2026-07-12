/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PlusCircle, Film, Play, Trash2, ArrowRight } from "lucide-react";
import { CoachClipProject } from "../types";

interface HomeScreenProps {
  projects: CoachClipProject[];
  onNewClip: () => void;
  onSelectProject: (proj: CoachClipProject) => void;
  onOpenPreview: (proj: CoachClipProject) => void;
  onDeleteProject: (id: string) => void;
  onViewAllProjects: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  projects,
  onNewClip,
  onSelectProject,
  onOpenPreview,
  onDeleteProject,
  onViewAllProjects,
}) => {
  const recentProjects = projects.slice(0, 3);

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-brand-dark to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="relative z-10 max-w-xl">
          <span className="bg-brand-accent/20 text-brand-accent text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border border-brand-accent/20">
            Enkel sportsanalyse
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mt-4 leading-tight">
            Find situationen. <br />
            Forklar den. Del den.
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-3 leading-relaxed">
            Det behøver ikke være svært at dele taktik. CoachClip lader dig isolere det vigtigste øjeblik, tegne direkte på videoen og downloade færdige MP4-klip på få sekunder.
          </p>
        </div>

        <button
          onClick={onNewClip}
          className="relative z-10 bg-brand-accent hover:bg-yellow-400 text-brand-dark font-black text-sm uppercase tracking-wider px-6 py-4 rounded-2xl flex items-center gap-2.5 transition-all active:scale-95 shadow-lg shadow-brand-accent/15 cursor-pointer shrink-0"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Nyt analyseklip</span>
        </button>

        {/* Decorative ambient backdrop shapes */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-clear/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      </div>

      {/* Guide Cards */}
      <div>
        <h3 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider mb-4">
          Sådan fungerer det på under 1 minut
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              step: "01",
              title: "Vælg din video",
              desc: "Upload en trænings- eller kampvideo direkte fra din mobil eller computer.",
            },
            {
              step: "02",
              title: "Isoler det vigtige",
              desc: "Brug tidsmarkører til at klippe videoen ned til den præcise sekvens.",
            },
            {
              step: "03",
              title: "Forklar med tegninger",
              desc: "Placer pile, cirkler og tekstkommentarer, frys billedet og eksporter med det samme.",
            },
          ].map((g, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden">
              <span className="absolute top-4 right-5 text-4xl font-black text-slate-100 font-mono">
                {g.step}
              </span>
              <h4 className="font-extrabold text-slate-800 text-sm mb-1.5 relative z-10">{g.title}</h4>
              <p className="text-slate-500 text-xs leading-relaxed relative z-10">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Analyses list */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider">
              Seneste analyser
            </h3>
            <p className="text-[10px] text-slate-400">Fortsæt redigeringen af dine nyligt oprettede klip.</p>
          </div>
          {projects.length > 3 && (
            <button
              onClick={onViewAllProjects}
              className="text-xs font-bold text-brand-clear hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Se alle</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center text-slate-400 flex flex-col items-center justify-center">
            <Film className="w-10 h-10 mb-2 opacity-40 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Du har endnu ikke lavet et analyseklip.</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Kom hurtigt i gang ved at trykke på "Nyt analyseklip" ovenfor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentProjects.map((proj) => {
              const len = proj.clip.endTime - proj.clip.startTime;

              return (
                <div
                  key={proj.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => onSelectProject(proj)}
                >
                  <div>
                    <div className="aspect-video w-full rounded-xl bg-slate-900 overflow-hidden mb-3.5 relative flex items-center justify-center">
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

                    <h4 className="font-extrabold text-slate-800 text-sm leading-tight mb-1 truncate">
                      {proj.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Opdateret: {new Date(proj.updatedAt).toLocaleDateString("da-DK")}
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        proj.exportStatus === "exported"
                          ? "bg-green-50 text-brand-success"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {proj.exportStatus === "exported" ? "Eksporteret" : "Ikke eksporteret"}
                    </span>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPreview(proj);
                        }}
                        className="p-1.5 hover:bg-slate-100 text-brand-clear rounded-lg cursor-pointer"
                        title="Afspil"
                      >
                        <Play className="w-4 h-4 fill-brand-clear" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(proj.id);
                        }}
                        className="p-1.5 hover:bg-slate-100 text-brand-error rounded-lg cursor-pointer"
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
    </div>
  );
};
