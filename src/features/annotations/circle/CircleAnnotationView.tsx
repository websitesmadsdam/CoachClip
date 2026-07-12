/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CircleAnnotation } from "../../../types";
import { usePointerDrag } from "../../../hooks/usePointerDrag";

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

  // Color mapping
  const strokeColor =
    annotation.color === "yellow"
      ? "#FFB020"
      : annotation.color === "red"
      ? "#D64545"
      : "#FFFFFF";

  const handleCenterDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onUpdate) {
      if (onSelect) onSelect();
      return;
    }
    e.stopPropagation();
    if (onSelect) onSelect();

    const initialX = annotation.x;
    const initialY = annotation.y;

    startCenterDrag(e, {
      onStart: () => {},
      onDrag: (clientX, clientY) => {
        const container = e.currentTarget.parentElement;
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

    startResizeDrag(e, {
      onStart: () => {},
      onDrag: (clientX, clientY) => {
        const container = e.currentTarget.parentElement?.parentElement;
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

  // Convert relative radius to percentages
  const widthPercent = annotation.radius * 2 * 100;
  const heightPercent = annotation.radius * 2 * 100;

  return (
    <div
      onPointerDown={handleCenterDown}
      className={`absolute select-none cursor-move group touch-action-none`}
      style={{
        left: `${(annotation.x * videoBounds.width + videoBounds.left)}px`,
        top: `${(annotation.y * videoBounds.height + videoBounds.top)}px`,
        width: `${annotation.radius * 2 * videoBounds.width}px`,
        height: `${annotation.radius * 2 * videoBounds.height}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "auto",
      }}
    >
      {/* Circle Shape */}
      <div
        className={`w-full h-full rounded-full transition-shadow ${
          isSelected ? "shadow-lg ring-2 ring-blue-400" : "group-hover:opacity-95"
        }`}
        style={{
          border: `${annotation.thickness === "bold" ? 4 : 2}px ${
            annotation.thickness === "bold" ? "solid" : "dashed"
          } ${strokeColor}`,
          backgroundColor: "rgba(255, 176, 32, 0.08)",
        }}
      />

      {/* Resize Handle (Only visible when selected and updatable) */}
      {isSelected && onUpdate && (
        <div
          onPointerDown={handleResizeDown}
          className="absolute flex items-center justify-center cursor-se-resize z-30"
          style={{
            right: "-22px",
            top: "50%",
            transform: "translate(0, -50%)",
            width: "44px", // Touch target size
            height: "44px",
          }}
        >
          {/* Visual dot */}
          <div className="w-4 h-4 bg-yellow-400 rounded-full border-2 border-white shadow-md active:scale-125 transition-transform" />
        </div>
      )}
    </div>
  );
};
