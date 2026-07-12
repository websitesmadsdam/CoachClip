/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback, Dispatch, SetStateAction, RefObject } from "react";
import { Annotation } from "../types";

export function useAnnotationSelection(
  annotations: Annotation[],
  setAnnotations: Dispatch<SetStateAction<Annotation[]>>,
  currentTime: number,
  videoRef: RefObject<HTMLVideoElement | null>
) {
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId) || null;

  const handleAnnotationSelect = useCallback((anno: Annotation) => {
    setSelectedAnnotationId(anno.id);
    
    // Seek to the start of the annotation
    if (videoRef.current) {
      videoRef.current.currentTime = anno.type === "freeze" ? anno.time : anno.startTime;
    }
  }, [videoRef]);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  }, [selectedAnnotationId, setAnnotations]);

  // Adjust coordinates of selected annotation
  const moveSelectedAnnotation = useCallback((dx: number, dy: number) => {
    if (!selectedAnnotationId) return;

    setAnnotations((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAnnotationId) return a;

        if (a.type === "text") {
          return {
            ...a,
            x: Math.max(0, Math.min(1, a.x + dx)),
            y: Math.max(0, Math.min(1, a.y + dy)),
          };
        } else if (a.type === "circle") {
          return {
            ...a,
            x: Math.max(0, Math.min(1, a.x + dx)),
            y: Math.max(0, Math.min(1, a.y + dy)),
          };
        } else if (a.type === "arrow") {
          return {
            ...a,
            startX: Math.max(0, Math.min(1, a.startX + dx)),
            startY: Math.max(0, Math.min(1, a.startY + dy)),
            endX: Math.max(0, Math.min(1, a.endX + dx)),
            endY: Math.max(0, Math.min(1, a.endY + dy)),
          };
        }
        return a;
      })
    );
  }, [selectedAnnotationId, setAnnotations]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside form inputs/textareas
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true");

      if (isTyping) return;

      if (!selectedAnnotationId) return;

      const step = e.shiftKey ? 0.05 : 0.01;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveSelectedAnnotation(0, -step);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveSelectedAnnotation(0, step);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveSelectedAnnotation(-step, 0);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveSelectedAnnotation(step, 0);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteAnnotation(selectedAnnotationId);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedAnnotationId, moveSelectedAnnotation, deleteAnnotation]);

  return {
    selectedAnnotationId,
    setSelectedAnnotationId,
    selectedAnnotation,
    handleAnnotationSelect,
    deleteAnnotation,
    moveSelectedAnnotation,
  };
}
