/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  FolderHeart, Plus, Trash2, ArrowUp, ArrowDown, Play, 
  Video, ChevronRight, X, Sparkles, FolderPlus, Clock, Film
} from "lucide-react";
import { Collection, CoachClipProject, Annotation, BRAND_COLORS } from "../types";
import { dbService } from "../db";

interface CollectionsScreenProps {
  projects: CoachClipProject[];
  onBackToHome: () => void;
  // Trigger project reload when edited
  onProjectsUpdate: () => void;
}

export const CollectionsScreen: React.FC<CollectionsScreenProps> = ({
  projects,
  onBackToHome,
  onProjectsUpdate,
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  
  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Playback Playlist Modal
  const [playlistPlaying, setPlaylistPlaying] = useState<boolean>(false);
  const [playlistProjects, setPlaylistProjects] = useState<CoachClipProject[]>([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(0);
  const [playlistVideoUrl, setPlaylistVideoUrl] = useState<string>("");
  const playlistVideoRef = useRef<HTMLVideoElement>(null);
  const [playlistCurrentTime, setPlaylistCurrentTime] = useState<number>(0);

  // Load collections
  const loadCollections = async () => {
    try {
      const all = await dbService.getAllCollections();
      setCollections(all);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const col: Collection = {
      id: "col_" + Date.now(),
      title: newTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectIds: []
    };

    try {
      await dbService.saveCollection(col);
      setNewTitle("");
      setIsCreateOpen(false);
      loadCollections();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Er du sikker på, du vil slette denne samling? Dine klip slettes ikke, kun selve samlingen.")) {
      try {
        await dbService.deleteCollection(id);
        if (activeCollectionId === id) setActiveCollectionId(null);
        loadCollections();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getCollectionProjects = (col: Collection) => {
    return col.projectIds
      .map(id => projects.find(p => p.id === id))
      .filter((p): p is CoachClipProject => !!p);
  };

  // Add project to collection
  const addProjectToCollection = async (collection: Collection, projectId: string) => {
    if (collection.projectIds.includes(projectId)) return;
    const updated = {
      ...collection,
      projectIds: [...collection.projectIds, projectId],
      updatedAt: new Date().toISOString()
    };
    await dbService.saveCollection(updated);
    loadCollections();
  };

  // Remove project from collection
  const removeProjectFromCollection = async (collection: Collection, projectId: string) => {
    const updated = {
      ...collection,
      projectIds: collection.projectIds.filter(id => id !== projectId),
      updatedAt: new Date().toISOString()
    };
    await dbService.saveCollection(updated);
    loadCollections();
  };

  // Reorder projects in collection
  const moveProject = async (collection: Collection, index: number, direction: "up" | "down") => {
    const newIds = [...collection.projectIds];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;

    // Swap
    const temp = newIds[index];
    newIds[index] = newIds[targetIndex];
    newIds[targetIndex] = temp;

    const updated = {
      ...collection,
      projectIds: newIds,
      updatedAt: new Date().toISOString()
    };
    await dbService.saveCollection(updated);
    loadCollections();
  };

  const getCollectionDuration = (col: Collection) => {
    const colProjects = getCollectionProjects(col);
    const sec = colProjects.reduce((acc, p) => acc + (p.clip.endTime - p.clip.startTime), 0);
    return Math.round(sec);
  };

  // Playback Playlist logic
  const startPlaylist = (col: Collection) => {
    const colProjects = getCollectionProjects(col);
    if (colProjects.length === 0) {
      alert("Tilføj venligst nogle klip til samlingen først!");
      return;
    }
    setPlaylistProjects(colProjects);
    setCurrentPlaylistIndex(0);
    setPlaylistPlaying(true);
    setPlaylistCurrentTime(0);
  };

  const activePlaylistProject = playlistProjects[currentPlaylistIndex];

  // Load video source for playlist item
  useEffect(() => {
    if (!activePlaylistProject) return;

    // We can search for the local file or mock/simulated url
    // In our prototype, if we don't have a direct file blob, we use a nice sample soccer video so that clicking play actually performs beautifully
    let videoUrl = "https://assets.mixkit.co/videos/preview/mixkit-player-jumping-in-a-basketball-game-34283-large.mp4"; // beautiful high contrast fallback
    if (activePlaylistProject.exportedVideoUrl) {
      videoUrl = activePlaylistProject.exportedVideoUrl;
    }

    setPlaylistVideoUrl(videoUrl);
    setPlaylistCurrentTime(activePlaylistProject.clip.startTime);

    if (playlistVideoRef.current) {
      playlistVideoRef.current.currentTime = activePlaylistProject.clip.startTime;
      playlistVideoRef.current.play().catch(() => {});
    }
  }, [currentPlaylistIndex, activePlaylistProject]);

  const handlePlaylistTimeUpdate = () => {
    const video = playlistVideoRef.current;
    if (!video || !activePlaylistProject) return;

    const t = video.currentTime;
    setPlaylistCurrentTime(t);

    if (t >= activePlaylistProject.clip.endTime) {
      // Move to next clip or end playlist
      if (currentPlaylistIndex < playlistProjects.length - 1) {
        setCurrentPlaylistIndex(prev => prev + 1);
      } else {
        // End of playlist
        setPlaylistPlaying(false);
        alert("Samlingen er færdigafspillet!");
      }
    }
  };

  // Check which annotations are active in current playlist video
  const getActivePlaylistAnnotations = () => {
    if (!activePlaylistProject) return [];
    return activePlaylistProject.annotations.filter(a => {
      if (a.type === "freeze") return false; // simple skip freeze in slideshow for now, or just display
      return playlistCurrentTime >= a.startTime && playlistCurrentTime <= a.endTime;
    });
  };

  const activePlaylistAnnos = getActivePlaylistAnnotations();
  const activeCol = collections.find(c => c.id === activeCollectionId);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col h-full bg-brand-bg pb-12">
      {/* Upper header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-dark flex items-center gap-2">
            <FolderHeart className="w-6 h-6 text-brand-clear" />
            <span>Taktiske Samlinger</span>
          </h2>
          <p className="text-xs text-slate-500">
            Organiser flere analyseklip i mapper for at præsentere dem til spillermøder eller udekampen.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-clear hover:bg-blue-600 active:scale-98 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-brand-clear/20 cursor-pointer"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Opret samling</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-start">
        {/* Left column: Collections list */}
        <div className="md:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase text-slate-600 tracking-wider">Dine mapper</h3>
          
          {collections.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
              <FolderHeart className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-70" />
              <p className="text-sm font-medium">Ingen samlinger endnu</p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-3 text-xs font-bold text-brand-clear hover:underline cursor-pointer"
              >
                Lav din første her
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {collections.map((col) => {
                const isActive = col.id === activeCollectionId;
                const pCount = col.projectIds.length;
                const dur = getCollectionDuration(col);

                return (
                  <div
                    key={col.id}
                    onClick={() => setActiveCollectionId(col.id)}
                    className={`p-4 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer group ${
                      isActive
                        ? "bg-brand-dark/5 border-brand-clear shadow-sm"
                        : "bg-white border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate leading-tight mb-1">
                        {col.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-0.5">
                          <Film className="w-3 h-3" />
                          {pCount} {pCount === 1 ? "klip" : "klip"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {dur} sek. varighed
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleDeleteCollection(col.id, e)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-brand-error rounded-lg cursor-pointer"
                        title="Slet samling"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Active collection detail and clips list */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[400px] flex flex-col">
          {activeCol ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Collection Banner Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-5 mb-5 gap-3">
                <div>
                  <h3 className="text-xl font-black text-brand-dark">{activeCol.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Samlet varighed: <span className="font-semibold text-slate-600">{getCollectionDuration(activeCol)}s</span> • 
                    Sidst ændret: <span className="font-semibold text-slate-600">{new Date(activeCol.updatedAt).toLocaleDateString("da-DK")}</span>
                  </p>
                </div>

                <button
                  onClick={() => startPlaylist(activeCol)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-success hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md shadow-brand-success/15 cursor-pointer active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Afspil samling</span>
                </button>
              </div>

              {/* Clips List */}
              <div className="flex-1 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Klip i denne samling ({activeCol.projectIds.length})</h4>
                
                {activeCol.projectIds.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl p-8 text-center text-slate-400">
                    <Video className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">Der er ingen klip i denne samling endnu.</p>
                    <p className="text-xs text-slate-400 mt-1">Tilføj dine analyserede klip fra listen nedenfor.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {getCollectionProjects(activeCol).map((p, idx) => {
                      const len = p.clip.endTime - p.clip.startTime;

                      return (
                        <div
                          key={p.id}
                          className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 p-3.5 rounded-xl flex items-center justify-between gap-3 group animate-fade-in"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-brand-dark/10 text-brand-dark text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{p.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                <span>{p.category || "Uden kategori"}</span>
                                <span>•</span>
                                <span>{len.toFixed(1)}s</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Sorting controls */}
                            <button
                              disabled={idx === 0}
                              onClick={() => moveProject(activeCol, idx, "up")}
                              className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
                              title="Flyt op"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={idx === activeCol.projectIds.length - 1}
                              onClick={() => moveProject(activeCol, idx, "down")}
                              className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
                              title="Flyt ned"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeProjectFromCollection(activeCol, p.id)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-brand-error rounded-lg cursor-pointer ml-2"
                              title="Fjern fra samling"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Section to add existing projects */}
                <hr className="border-slate-100 my-6" />
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tilføj dine andre klip</h4>
                
                {projects.filter(p => !activeCol.projectIds.includes(p.id)).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Alle dine eksisterende projekter er allerede tilføjet til denne samling.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {projects
                      .filter(p => !activeCol.projectIds.includes(p.id))
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => addProjectToCollection(activeCol, p.id)}
                          className="p-3 border border-slate-200/60 rounded-xl hover:border-brand-clear hover:bg-brand-clear/5 transition-all text-left flex items-center justify-between cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{p.title}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{(p.clip.endTime - p.clip.startTime).toFixed(1)}s • {p.category || "Uden kat."}</p>
                          </div>
                          <Plus className="w-4 h-4 text-brand-clear shrink-0 ml-1" />
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <FolderHeart className="w-12 h-12 mb-3 text-slate-300 opacity-60" />
              <p className="text-base font-bold text-slate-700">Vælg en samling i menuen til venstre</p>
              <p className="text-xs mt-1">Her kan du sammensætte klip, ændre rækkefølge og afspille dem som et taktikmøde.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE COLLECTION MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleCreateCollection}
            className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl relative animate-scale-up"
          >
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-extrabold text-brand-dark mb-1 flex items-center gap-1.5">
              <FolderHeart className="w-5 h-5 text-brand-clear" />
              Opret ny samling
            </h3>
            <p className="text-xs text-slate-500 mb-5">Indtast en sigende titel, f.eks. modstanderens holdnavn.</p>

            <div className="mb-5">
              <label className="text-xs font-bold text-slate-700 block mb-1">Samlingens navn</label>
              <input
                type="text"
                required
                placeholder="F.eks. Taktik mod Ajax København"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-brand-clear"
                autoFocus
              />
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Annuller
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-brand-clear hover:bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
              >
                Opret samling
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PLAYLIST IMMERSIVE PLAYBACK VIEWER */}
      {playlistPlaying && activePlaylistProject && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col text-white animate-fade-in select-none">
          {/* Header */}
          <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1 bg-brand-clear text-xs font-black rounded-md">
                Klip {currentPlaylistIndex + 1} af {playlistProjects.length}
              </div>
              <div>
                <h4 className="font-extrabold text-sm truncate max-w-[200px] sm:max-w-xs">{activePlaylistProject.title}</h4>
                <p className="text-[10px] text-zinc-400 mt-0.5 capitalize">{activePlaylistProject.feedbackType === "positive" ? "✓ Det gør vi godt" : "⚠ Det skal vi udvikle"}</p>
              </div>
            </div>

            <button
              onClick={() => setPlaylistPlaying(false)}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white cursor-pointer"
              title="Luk playliste"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Central Immersive Player Stage */}
          <div className="flex-1 flex items-center justify-center p-4 relative bg-black">
            <div className="relative w-full max-w-4xl aspect-video bg-zinc-950 rounded-xl overflow-hidden shadow-2xl">
              <video
                ref={playlistVideoRef}
                src={playlistVideoUrl}
                className="w-full h-full object-cover"
                onTimeUpdate={handlePlaylistTimeUpdate}
                playsInline
                autoPlay
              />

              {/* Annotation Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full absolute inset-0">
                  <defs>
                    <marker id="arrow-pl-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={BRAND_COLORS.accent} />
                    </marker>
                    <marker id="arrow-pl-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={BRAND_COLORS.error} />
                    </marker>
                    <marker id="arrow-pl-white" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#FFFFFF" />
                    </marker>
                  </defs>

                  {/* Playback arrows */}
                  {activePlaylistAnnos.filter(a => a.type === "arrow").map((arrow: any) => (
                    <line
                      key={arrow.id}
                      x1={`${arrow.startX * 100}%`}
                      y1={`${arrow.startY * 100}%`}
                      x2={`${arrow.endX * 100}%`}
                      y2={`${arrow.endY * 100}%`}
                      stroke={arrow.color === "yellow" ? BRAND_COLORS.accent : arrow.color === "red" ? BRAND_COLORS.error : "#FFFFFF"}
                      strokeWidth="4"
                      markerEnd={`url(#arrow-pl-${arrow.color})`}
                    />
                  ))}
                </svg>

                {/* Playback circles */}
                {activePlaylistAnnos.filter(a => a.type === "circle").map((circle: any) => (
                  <div
                    key={circle.id}
                    className="absolute rounded-full border-4"
                    style={{
                      left: `${circle.x * 100}%`,
                      top: `${circle.y * 100}%`,
                      width: `${circle.radius * 200}%`,
                      height: `${circle.radius * 200}%`,
                      transform: "translate(-50%, -50%)",
                      borderColor: circle.color === "yellow" ? BRAND_COLORS.accent : circle.color === "red" ? BRAND_COLORS.error : "#FFFFFF",
                      borderStyle: circle.thickness === "bold" ? "solid" : "dashed",
                    }}
                  />
                ))}

                {/* Playback texts */}
                {activePlaylistAnnos.filter(a => a.type === "text").map((text: any) => (
                  <div
                    key={text.id}
                    className="absolute px-3 py-1.5 rounded-lg text-white font-semibold text-center bg-black/70 shadow-lg"
                    style={{
                      left: `${text.x * 100}%`,
                      top: `${text.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: text.size === "small" ? "12px" : text.size === "large" ? "18px" : "15px",
                    }}
                  >
                    {text.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="bg-zinc-900 border-t border-zinc-800 p-4 shrink-0 flex items-center justify-between">
            <button
              disabled={currentPlaylistIndex === 0}
              onClick={() => setCurrentPlaylistIndex(prev => prev - 1)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-bold rounded-lg disabled:opacity-30 cursor-pointer"
            >
              Forrige klip
            </button>

            <div className="text-xs text-zinc-400 font-mono">
              Spiller: {(playlistCurrentTime - activePlaylistProject.clip.startTime).toFixed(1)}s / {(activePlaylistProject.clip.endTime - activePlaylistProject.clip.startTime).toFixed(1)}s
            </div>

            <button
              disabled={currentPlaylistIndex === playlistProjects.length - 1}
              onClick={() => setCurrentPlaylistIndex(prev => prev + 1)}
              className="px-4 py-2 bg-brand-clear hover:bg-blue-600 text-sm font-bold rounded-lg disabled:opacity-30 cursor-pointer"
            >
              Næste klip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
