/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: usePointerDrag hook requires raw any typecasting for specific React PointerEvent extensions and handles silent error ignores.
 */

import { useState, useCallback, PointerEvent as ReactPointerEvent } from "react";

interface PointerDragConfig {
  onStart?: (clientX: number, clientY: number, event: ReactPointerEvent) => void;
  onDrag?: (clientX: number, clientY: number, event: ReactPointerEvent) => void;
  onEnd?: (event: ReactPointerEvent) => void;
}

export function usePointerDrag() {
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback(
    (event: ReactPointerEvent, config: PointerDragConfig) => {
      // Prevent browser default touch behavior (scrolling) during dragging
      event.preventDefault();
      
      const target = event.currentTarget as HTMLElement;
      try {
        target.setPointerCapture(event.pointerId);
      } catch (err) {
        // Fallback if setPointerCapture is unsupported
        console.warn("setPointerCapture not supported:", err);
      }

      setIsDragging(true);
      if (config.onStart) {
        config.onStart(event.clientX, event.clientY, event);
      }

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (config.onDrag) {
          config.onDrag(moveEvent.clientX, moveEvent.clientY, moveEvent as any);
        }
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        setIsDragging(false);
        try {
          target.releasePointerCapture(event.pointerId);
        } catch (err) {
          // ignore
        }
        
        target.removeEventListener("pointermove", handlePointerMove);
        target.removeEventListener("pointerup", handlePointerUp);
        target.removeEventListener("pointercancel", handlePointerUp);

        if (config.onEnd) {
          config.onEnd(upEvent as any);
        }
      };

      target.addEventListener("pointermove", handlePointerMove);
      target.addEventListener("pointerup", handlePointerUp);
      target.addEventListener("pointercancel", handlePointerUp);
    },
    []
  );

  return {
    isDragging,
    startDrag,
  };
}
