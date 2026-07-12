/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TextAnnotation } from "../../../types";
import { usePointerDrag } from "../../../hooks/usePointerDrag";

interface TextAnnotationViewProps {
  annotation: TextAnnotation;
  isSelected: boolean;
  onSelect?: () => void;
  onUpdate?: (updated: TextAnnotation) => void;
  videoBounds: { width: number; height: number; left: number; top: number };
}

export const TextAnnotationView: React.FC<TextAnnotationViewProps> = ({
  annotation,
  isSelected,
  onSelect,
  onUpdate,
  videoBounds,
}) => {
  const { startDrag } = usePointerDrag();

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onUpdate) {
      if (onSelect) onSelect();
      return;
    }
    e.stopPropagation();
    if (onSelect) onSelect();

    startDrag(e, {
      onStart: () => {},
      onDrag: (clientX, clientY) => {
        const container = e.currentTarget.parentElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();

        const px = (clientX - rect.left - videoBounds.left) / videoBounds.width;
        const py = (clientY - rect.top - videoBounds.top) / videoBounds.height;

        onUpdate({
          ...annotation,
          x: Math.max(0.02, Math.min(0.98, px)),
          y: Math.max(0.02, Math.min(0.98, py)),
        });
      },
    });
  };

  // Size mapping
  const sizeClass =
    annotation.size === "small"
      ? "text-xs px-2 py-1"
      : annotation.size === "large"
      ? "text-lg px-4 py-2"
      : "text-sm md:text-base px-3 py-1.5";

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`absolute cursor-move select-none z-20 rounded-lg text-white font-semibold bg-black/75 hover:bg-black/85 transition-all text-center border-2 border-transparent max-w-[240px] break-words shadow-md ${
        isSelected ? "border-blue-400 shadow-xl scale-102 ring-2 ring-blue-400/30" : ""
      } ${sizeClass} touch-action-none`}
      style={{
        left: `${annotation.x * videoBounds.width + videoBounds.left}px`,
        top: `${annotation.y * videoBounds.height + videoBounds.top}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "auto",
      }}
    >
      {annotation.text || "Indtast tekst..."}
    </div>
  );
};
