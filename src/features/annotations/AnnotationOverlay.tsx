/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from "react";
import { Annotation, TextAnnotation, CircleAnnotation, ArrowAnnotation } from "../../types";
import { CircleAnnotationView } from "./circle/CircleAnnotationView";
import { ArrowAnnotationView } from "./arrow/ArrowAnnotationView";
import { TextAnnotationView } from "./text/TextAnnotationView";
import { getDisplayedVideoBounds } from "../../utils/videoUtils";
import { usePointerDrag } from "../../hooks/usePointerDrag";

interface AnnotationOverlayProps {
  annotations: Annotation[];
  currentTime: number;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (anno: Annotation) => void;
  onUpdateAnnotation: (anno: Annotation) => void;
  activeTool: "text" | "circle" | "arrow" | "freeze" | null;
  draftAnnotation: Partial<Annotation> | null;
  onUpdateDraft: (draft: Partial<Annotation> | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoWidth?: number;
  videoHeight?: number;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  annotations,
  currentTime,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
  activeTool,
  draftAnnotation,
  onUpdateDraft,
  containerRef,
  videoWidth = 1920,
  videoHeight = 1080,
}) => {
  const [videoBounds, setVideoBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const { startDrag } = usePointerDrag();

  const updateBounds = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const bounds = getDisplayedVideoBounds(
      rect.width,
      rect.height,
      videoWidth,
      videoHeight
    );
    setVideoBounds(bounds);
  }, [containerRef, videoWidth, videoHeight]);

  // Monitor resizes
  useEffect(() => {
    updateBounds();
    const observer = new ResizeObserver(() => updateBounds());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [containerRef, updateBounds]);

  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0.5, y: 0.5 };
    const rect = containerRef.current.getBoundingClientRect();
    
    // Relative to the displayed video bounds inside the container
    const x = (clientX - rect.left - videoBounds.left) / videoBounds.width;
    const y = (clientY - rect.top - videoBounds.top) / videoBounds.height;

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeTool || e.target !== e.currentTarget) return;
    e.preventDefault();

    const coords = getRelativeCoords(e.clientX, e.clientY);

    if (activeTool === "text") {
      const draft: TextAnnotation = {
        id: "text_" + Date.now(),
        type: "text",
        startTime: currentTime,
        endTime: currentTime + 3,
        text: "",
        x: coords.x,
        y: coords.y,
        size: "normal",
        positionPreset: "bottom",
      };
      onUpdateDraft(draft);
      
      startDrag(e, {
        onDrag: (cx, cy) => {
          const c = getRelativeCoords(cx, cy);
          onUpdateDraft({ ...draft, x: c.x, y: c.y });
        }
      });
    } else if (activeTool === "circle") {
      const draft: CircleAnnotation = {
        id: "circle_" + Date.now(),
        type: "circle",
        startTime: currentTime,
        endTime: currentTime + 3,
        x: coords.x,
        y: coords.y,
        radius: 0.08,
        color: "yellow",
        thickness: "bold",
      };
      onUpdateDraft(draft);

      startDrag(e, {
        onDrag: (cx, cy) => {
          const c = getRelativeCoords(cx, cy);
          onUpdateDraft({ ...draft, x: c.x, y: c.y });
        }
      });
    } else if (activeTool === "arrow") {
      const draft: ArrowAnnotation = {
        id: "arrow_" + Date.now(),
        type: "arrow",
        startTime: currentTime,
        endTime: currentTime + 3,
        startX: coords.x,
        startY: coords.y,
        endX: coords.x + 0.1,
        endY: coords.y - 0.1,
        color: "yellow",
      };
      onUpdateDraft(draft);

      startDrag(e, {
        onDrag: (cx, cy) => {
          const c = getRelativeCoords(cx, cy);
          onUpdateDraft({ ...draft, endX: c.x, endY: c.y });
        }
      });
    }
  };

  // Filter annotations valid at current timestamp (and hide if a freeze annotation is active)
  const activeAnnotations = annotations.filter((a) => {
    if (a.type === "freeze") return false; // Rendered separately if needed, or has no overlay
    return currentTime >= a.startTime && currentTime <= a.endTime;
  });

  return (
    <div
      onPointerDown={handlePointerDown}
      className="absolute inset-0 z-20 pointer-events-auto overflow-hidden select-none"
      style={{ touchAction: activeTool ? "none" : "auto" }}
    >
      {/* Existing Saved Annotations */}
      {activeAnnotations.map((anno) => {
        const isSelected = selectedAnnotationId === anno.id;

        if (anno.type === "circle") {
          return (
            <CircleAnnotationView
              key={anno.id}
              annotation={anno}
              isSelected={isSelected}
              onSelect={() => onSelectAnnotation(anno)}
              onUpdate={(up) => onUpdateAnnotation(up)}
              videoBounds={videoBounds}
            />
          );
        } else if (anno.type === "arrow") {
          return (
            <ArrowAnnotationView
              key={anno.id}
              annotation={anno}
              isSelected={isSelected}
              onSelect={() => onSelectAnnotation(anno)}
              onUpdate={(up) => onUpdateAnnotation(up)}
              videoBounds={videoBounds}
            />
          );
        } else if (anno.type === "text") {
          return (
            <TextAnnotationView
              key={anno.id}
              annotation={anno}
              isSelected={isSelected}
              onSelect={() => onSelectAnnotation(anno)}
              onUpdate={(up) => onUpdateAnnotation(up)}
              videoBounds={videoBounds}
            />
          );
        }
        return null;
      })}

      {/* active draft annotation */}
      {draftAnnotation && (
        <>
          {draftAnnotation.type === "circle" && (
            <CircleAnnotationView
              annotation={draftAnnotation as CircleAnnotation}
              isSelected={true}
              onUpdate={(up) => onUpdateDraft(up)}
              videoBounds={videoBounds}
            />
          )}
          {draftAnnotation.type === "arrow" && (
            <ArrowAnnotationView
              annotation={draftAnnotation as ArrowAnnotation}
              isSelected={true}
              onUpdate={(up) => onUpdateDraft(up)}
              videoBounds={videoBounds}
            />
          )}
          {draftAnnotation.type === "text" && (
            <TextAnnotationView
              annotation={draftAnnotation as TextAnnotation}
              isSelected={true}
              onUpdate={(up) => onUpdateDraft(up)}
              videoBounds={videoBounds}
            />
          )}
        </>
      )}
    </div>
  );
};
