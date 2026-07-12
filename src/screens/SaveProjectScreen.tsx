/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Check, ArrowLeft, FolderPlus, FolderOpen } from "lucide-react";
import { Collection } from "../types";

interface SaveProjectScreenProps {
  initialTitle: string;
  initialFeedbackType: "positive" | "development";
  initialCategory: string;
  initialCollectionId: string;
  collections: Collection[];
  onBack: () => void;
  onSave: (data: {
    title: string;
    feedbackType: "positive" | "development";
    category: string;
    collectionId: string;
    newCollectionTitle?: string;
  }) => void;
}

export const SaveProjectScreen: React.FC<SaveProjectScreenProps> = ({
  initialTitle,
  initialFeedbackType,
  initialCategory,
  initialCollectionId,
  collections,
  onBack,
  onSave,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [feedbackType, setFeedbackType] = useState<"positive" | "development">(initialFeedbackType);
  const [category, setCategory] = useState(initialCategory || "Angreb");
  const [collectionId, setCollectionId] = useState(initialCollectionId || "none");
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [showNewColField, setShowNewColField] = useState(false);

  const handleSaveClick = (exportNow: boolean) => {
    if (!title.trim()) {
      alert("Angiv venligst en titel på klippet.");
      return;
    }

    onSave({
      title: title.trim(),
      feedbackType,
      category,
      collectionId,
      newCollectionTitle: showNewColField ? newCollectionTitle.trim() : undefined,
    });
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm animate-scale-up">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 cursor-pointer"
          title="Tilbage til gennemsyn"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-xl font-black text-brand-dark">Gem dit klip</h3>
          <p className="text-xs text-slate-400 font-medium">Tilføj taktiske detaljer, så du og spillerne nemt kan finde det.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Title */}
        <div>
          <label className="text-xs font-black text-slate-700 block mb-1.5 uppercase tracking-wider">Klippets titel *</label>
          <input
            type="text"
            required
            placeholder="F.eks. God opdækning ved hjørnekast"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-clear/20 focus:border-brand-clear transition-all"
          />
        </div>

        {/* Feedback category (Positive / Needs adjustments) */}
        <div>
          <label className="text-xs font-black text-slate-700 block mb-1.5 uppercase tracking-wider">Formål med sekvensen</label>
          <div className="grid grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => setFeedbackType("positive")}
              className={`py-3.5 px-4 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                feedbackType === "positive"
                  ? "border-brand-success bg-brand-success/5 text-brand-success shadow-xs"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-brand-success" />
              <span>Positivt eksempel</span>
            </button>

            <button
              type="button"
              onClick={() => setFeedbackType("development")}
              className={`py-3.5 px-4 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                feedbackType === "development"
                  ? "border-brand-error bg-brand-error/5 text-brand-error shadow-xs"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-brand-error" />
              <span>Udviklingspunkt</span>
            </button>
          </div>
        </div>

        {/* Categories */}
        <div>
          <label className="text-xs font-black text-slate-700 block mb-1.5 uppercase tracking-wider">Spilkategori</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-clear/20 focus:border-brand-clear cursor-pointer"
          >
            {["Angreb", "Forsvar", "Kontra", "Returløb", "Afslutning", "Målvogter", "Individuel teknik", "Andet"].map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Collections option */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Taktisk samling (Valgfri)</label>
            <button
              type="button"
              onClick={() => setShowNewColField(!showNewColField)}
              className="text-[11px] text-brand-clear font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              {showNewColField ? (
                <>
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Vælg eksisterende</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ Opret ny samling</span>
                </>
              )}
            </button>
          </div>

          {showNewColField ? (
            <input
              type="text"
              placeholder="F.eks. Kontraspil Træning 12. Marts..."
              value={newCollectionTitle}
              onChange={(e) => setNewCollectionTitle(e.target.value)}
              className="w-full p-3.5 border border-brand-clear rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-clear/20 animate-fade-in"
              autoFocus
            />
          ) : (
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-clear/20 focus:border-brand-clear cursor-pointer"
            >
              <option value="none">Ingen samling (gem kun i Mine projekter)</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action button triggers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={() => handleSaveClick(false)}
            className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
          >
            Gem uden eksport
          </button>
          <button
            type="button"
            onClick={() => handleSaveClick(true)}
            className="py-4 bg-brand-clear hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-brand-clear/15 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4.5 h-4.5 stroke-[3]" />
            <span>Gem og eksportér</span>
          </button>
        </div>
      </div>
    </div>
  );
};
