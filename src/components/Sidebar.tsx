/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Film, LayoutGrid, FolderHeart, Settings, PlusCircle } from "lucide-react";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onNewClip: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, onNewClip }) => {
  return (
    <aside className="w-64 bg-brand-dark text-white flex flex-col justify-between border-r border-slate-700 h-screen sticky top-0 shrink-0">
      <div className="p-6 flex flex-col gap-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentTab("home")}>
          <div className="w-10 h-10 rounded-xl bg-brand-clear flex items-center justify-center shadow-lg shadow-brand-clear/30">
            <Film className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-xl tracking-tight leading-none text-white">CoachClip</h1>
            <span className="text-[10px] text-brand-accent font-medium uppercase tracking-wider">Videoanalyse</span>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={onNewClip}
          className="w-full flex items-center justify-center gap-2 bg-brand-clear hover:bg-blue-600 active:scale-98 transition-all py-3 px-4 rounded-xl font-medium text-sm text-white shadow-md shadow-brand-clear/20 cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Nyt analyseklip</span>
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => setCurrentTab("home")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentTab === "home"
                ? "bg-brand-clear/10 text-brand-clear"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span>Forside</span>
          </button>

          <button
            onClick={() => setCurrentTab("projects")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentTab === "projects"
                ? "bg-brand-clear/10 text-brand-clear"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Film className="w-5 h-5" />
            <span>Mine projekter</span>
          </button>

          <button
            onClick={() => setCurrentTab("collections")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentTab === "collections"
                ? "bg-brand-clear/10 text-brand-clear"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <FolderHeart className="w-5 h-5" />
            <span>Samlinger</span>
          </button>

          <button
            onClick={() => setCurrentTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentTab === "settings"
                ? "bg-brand-clear/10 text-brand-clear"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Indstillinger</span>
          </button>
        </nav>
      </div>

      {/* Footer info */}
      <div className="p-6 border-t border-slate-800 text-xs text-slate-400">
        <p className="font-semibold">CoachClip MVP v1.0</p>
        <p className="mt-1 text-[10px]">Find situationen. Forklar den. Del den.</p>
      </div>
    </aside>
  );
};
