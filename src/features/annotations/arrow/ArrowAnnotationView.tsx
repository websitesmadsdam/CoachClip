/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ArrowAnnotation } from "../../../types";
import { usePointerDrag } from "../../../hooks/usePointerDrag";

interface ArrowAnnotationViewProps {
  annotation: ArrowAnnotation;
  isSelected: boolean;
  onSelect?: () => void;
  onUpdate?: (updated: ArrowAnnotation) => void;
  videoBounds: { width: number; height: number; left: number; top: number };
}

export const ArrowAnnotationView: React.FC<ArrowAnnotationViewProps> = ({
  annotation,
  isSelected,
  onSelect,
  onUpdate,
  videoBounds,
}) => {
  const { startDrag: startNodeDrag } = usePointerDrag();

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) onSelect();
  };

  // Convert relative coordinates to pixels
  const sx = annotation.startX * videoBounds.width + videoBounds.left;
  const sy = annotation.startY * videoBounds.height + videoBounds.top;
  const ex = annotation.endX * videoBounds.width + videoBounds.left;
  const ey = annotation.endY * videoBounds.height + videoBounds.top;

  // Arrow color
  const strokeColor =
    annotation.color === "yellow"
      ? "#FFB020"
      : annotation.color === "red"
      ? "#D64545"
      : "#FFFFFF";

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    part: "start" | "end" | "middle"
  ) => {
    if (!onUpdate) {
      if (onSelect) onSelect();
      return;
    }
    e.stopPropagation();
    if (onSelect) onSelect();

    const initStartX = annotation.startX;
    const initStartY = annotation.startY;
    const initEndX = annotation.endX;
    const initEndY = annotation.endY;

    startNodeDrag(e, {
      onStart: () => {},
      onDrag: (clientX, clientY) => {
        const container = e.currentTarget.parentElement?.parentElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();

        const px = (clientX - rect.left - videoBounds.left) / videoBounds.width;
        const py = (clientY - rect.top - videoBounds.top) / videoBounds.height;

        const clampedX = Math.max(0, Math.min(1, px));
        const clampedY = Math.max(0, Math.min(1, py));

        if (part === "start") {
          onUpdate({
            ...annotation,
            startX: clampedX,
            startY: clampedY,
          });
        } else if (part === "end") {
          onUpdate({
            ...annotation,
            endX: clampedX,
            endY: clampedY,
          });
        } else if (part === "middle") {
          // Dragging whole arrow
          const dx = px - ((initStartX + initEndX) / 2);
          const dy = py - ((initStartY + initEndY) / 2);
          
          onUpdate({
            ...annotation,
            startX: Math.max(0, Math.min(1, initStartX + dx)),
            startY: Math.max(0, Math.min(1, initStartY + dy)),
            endX: Math.max(0, Math.min(1, initEndX + dx)),
            endY: Math.max(0, Math.min(1, initEndY + dy)),
          });
        }
      },
    });
  };

  // Middle point for clicking/selecting the arrow line itself
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10">
      {/* SVG Container for arrow vector */}
      <svg className="w-full h-full absolute inset-0">
        <defs>
          <marker
            id={`arrowhead-${annotation.id}`}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill={strokeColor} />
          </marker>
        </defs>
        
        {/* Clickable thicker line background */}
        <line
          x1={sx}
          y1={sy}
          x2={ex}
          y2={ey}
          stroke="transparent"
          strokeWidth="20"
          className="cursor-pointer pointer-events-auto"
          onClick={handleSelect}
        />

        {/* Real visible vector */}
        <line
          x1={sx}
          y1={sy}
          x2={ex}
          y2={ey}
          stroke={strokeColor}
          strokeWidth="4"
          markerEnd={`url(#arrowhead-${annotation.id})`}
          className={isSelected ? "drop-shadow-lg" : ""}
        />
      </svg>

      {/* Invisible Middle Anchor to drag whole arrow */}
      <div
        onPointerDown={(e) => handlePointerDown(e, "middle")}
        className="absolute cursor-move pointer-events-auto flex items-center justify-center rounded-full"
        style={{
          left: `${mx}px`,
          top: `${my}px`,
          width: "36px",
          height: "36px",
          transform: "translate(-50%, -50%)",
        }}
      >
        {isSelected && (
          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full border border-white shadow" />
        )}
      </div>

      {/* Touch-Friendly Start Node Handle */}
      {isSelected && onUpdate && (
        <div
          onPointerDown={(e) => handlePointerDown(e, "start")}
          className="absolute cursor-move pointer-events-auto flex items-center justify-center z-30"
          style={{
            left: `${sx}px`,
            top: `${sy}px`,
            width: "44px", // Big touch area
            height: "44px",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md active:scale-125 transition-transform" />
        </div>
      )}

      {/* Touch-Friendly End Node Handle */}
      {isSelected && onUpdate && (
        <div
          onPointerDown={(e) => handlePointerDown(e, "end")}
          className="absolute cursor-move pointer-events-auto flex items-center justify-center z-30"
          style={{
            left: `${ex}px`,
            top: `${ey}px`,
            width: "44px", // Big touch area
            height: "44px",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-4 h-4 bg-yellow-400 rounded-full border-2 border-white shadow-md active:scale-125 transition-transform" />
        </div>
      )}
    </div>
  );
};
