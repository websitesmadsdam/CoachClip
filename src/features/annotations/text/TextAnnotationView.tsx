/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TextAnnotation } from "../../../types";
import { usePointerDrag } from "../../../hooks/usePointerDrag";
import { layoutTextAnnotation } from "../../../../shared/annotationGeometry";
import { measureAnnotationText } from "../measureAnnotationText";

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
    // Read now: React clears e.currentTarget once this handler returns, before any pointermove
    const container = e.currentTarget.parentElement;

    startDrag(e, {
      onStart: () => {},
      onDrag: (clientX, clientY) => {
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

  const layout = layoutTextAnnotation(
    videoBounds.width,
    videoBounds.height,
    annotation.x,
    annotation.y,
    annotation.size,
    annotation.text,
    measureAnnotationText
  );
  const isEmpty = layout.lines.length === 0;

  // Hit area sized like the drawn text box; the text itself is drawn by AnnotationCanvas.
  // An empty draft has nothing to draw, so it shows a visible placeholder instead.
  return (
    <div
      data-testid="text-annotation"
      onPointerDown={handlePointerDown}
      className={`absolute cursor-move select-none z-20 rounded-lg touch-action-none ${
        isSelected ? "ring-2 ring-blue-400" : ""
      } ${isEmpty ? "bg-black/60 text-white/80 text-xs font-semibold px-3 py-1.5 -translate-x-1/2 -translate-y-1/2" : ""}`}
      style={
        isEmpty
          ? {
              left: `${annotation.x * videoBounds.width + videoBounds.left}px`,
              top: `${annotation.y * videoBounds.height + videoBounds.top}px`,
              pointerEvents: "auto",
            }
          : {
              left: `${videoBounds.left + layout.rectX}px`,
              top: `${videoBounds.top + layout.rectY}px`,
              width: `${layout.boxWidth}px`,
              height: `${layout.boxHeight}px`,
              pointerEvents: "auto",
            }
      }
    >
      {isEmpty ? "Indtast tekst..." : null}
    </div>
  );
};
