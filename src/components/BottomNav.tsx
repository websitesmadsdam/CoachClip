/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { LayoutGrid, PlusCircle, Film, Settings } from "lucide-react";

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onNewClip: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab, onNewClip }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-brand-dark border-t border-slate-800 text-white flex items-center justify-around z-50 px-4 pb-safe md:hidden shadow-lg">
      <button
        onClick={() => setCurrentTab("home")}
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 cursor-pointer transition-colors ${
          currentTab === "home" ? "text-brand-clear" : "text-slate-400 hover:text-white"
        }`}
      >
        <LayoutGrid className="w-5 h-5" />
        <span className="text-[10px] font-medium leading-none">Forside</span>
      </button>

      <button
        onClick={() => setCurrentTab("projects")}
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 cursor-pointer transition-colors ${
          currentTab === "projects" ? "text-brand-clear" : "text-slate-400 hover:text-white"
        }`}
      >
        <Film className="w-5 h-5" />
        <span className="text-[10px] font-medium leading-none">Projekter</span>
      </button>

      <button
        onClick={onNewClip}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 cursor-pointer text-brand-accent hover:text-amber-400"
      >
        <PlusCircle className="w-6 h-6" />
        <span className="text-[10px] font-semibold leading-none">Nyt klip</span>
      </button>

      <button
        onClick={() => setCurrentTab("settings")}
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 cursor-pointer transition-colors ${
          currentTab === "settings" ? "text-brand-clear" : "text-slate-400 hover:text-white"
        }`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px] font-medium leading-none">Indstillinger</span>
      </button>
    </nav>
  );
};
