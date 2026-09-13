/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CircleAnnotation } from "../../../types";
import { usePointerDrag } from "../../../hooks/usePointerDrag";
import { getCircleGeometry } from "../../../../shared/annotationGeometry";

interface CircleAnnotationViewProps {
  annotation: CircleAnnotation;
  isSelected: boolean;
  onSelect?: () => void;
  onUpdate?: (updated: CircleAnnotation) => void;
  videoBounds: { width: number; height: number; left: number; top: number };
}

export const CircleAnnotationView: React.FC<CircleAnnotationViewProps> = ({
  annotation,
  isSelected,
  onSelect,
  onUpdate,
  videoBounds,
}) => {
  const { startDrag: startCenterDrag } = usePointerDrag();
  const { startDrag: startResizeDrag } = usePointerDrag();

  const handleCenterDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onUpdate) {
      if (onSelect) onSelect();
      return;
    }
    e.stopPropagation();
    if (onSelect) onSelect();
    // Read now: React clears e.currentTarget once this handler returns, before any pointermove
    const container = e.currentTarget.parentElement;

    startCenterDrag(e, {
      onStart: () => {},
      onDrag: (clientX, clientY) => {
        if (!container) return;
        const rect = container.getBoundingClientRect();

        // Account for letterboxing
        const px = (clientX - rect.left - videoBounds.left) / videoBounds.width;
        const py = (clientY - rect.top - videoBounds.top) / videoBounds.height;

        onUpdate({
          ...annotation,
          x: Math.max(0, Math.min(1, px)),
          y: Math.max(0, Math.min(1, py)),
        });
      },
    });
  };

  const handleResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const initialX = annotation.x;
    const initialY = annotation.y;
    // Read now: React clears e.currentTarget once this handler returns, before any pointermove
    const container = e.currentTarget.parentElement?.parentElement;

    startResizeDrag(e, {
      onStart: () => {},
      onDrag: (clientX, clientY) => {
        if (!container) return;
        const rect = container.getBoundingClientRect();

        const px = (clientX - rect.left - videoBounds.left) / videoBounds.width;
        const py = (clientY - rect.top - videoBounds.top) / videoBounds.height;

        // Distance from center is radius
        const dx = px - initialX;
        const dy = py - initialY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        onUpdate!({
          ...annotation,
          radius: Math.max(0.02, Math.min(0.4, distance)),
        });
      },
    });
  };

  const { radiusPx } = getCircleGeometry(videoBounds.width, videoBounds.height, annotation.radius);

  return (
    <div
      onPointerDown={handleCenterDown}
      className={`absolute select-none cursor-move group touch-action-none`}
      style={{
        left: `${(annotation.x * videoBounds.width + videoBounds.left)}px`,
        top: `${(annotation.y * videoBounds.height + videoBounds.top)}px`,
        width: `${radiusPx * 2}px`,
        height: `${radiusPx * 2}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "auto",
      }}
    >
      {/* Hit area; the circle itself is drawn by AnnotationCanvas */}
      <div className={`w-full h-full rounded-full transition-shadow ${isSelected ? "ring-2 ring-blue-400" : ""}`} />

      {/* Resize Handle (Only visible when selected and updatable) */}
      {isSelected && onUpdate && (
        <div
          onPointerDown={handleResizeDown}
          className="absolute flex items-center justify-center cursor-se-resize z-30"
          style={{
            right: "-24px",
            top: "50%",
            transform: "translate(0, -50%)",
            width: "48px", // Finger-sized touch area
            height: "48px",
          }}
        >
          {/* Visual dot */}
          <div className="w-5 h-5 bg-yellow-400 rounded-full border-2 border-white shadow-md active:scale-125 transition-transform" />
        </div>
      )}
    </div>
  );
};
