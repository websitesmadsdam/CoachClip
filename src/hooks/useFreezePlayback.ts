/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Annotation } from "../types";

export function useFreezePlayback(
  currentTime: number,
  annotations: Annotation[],
  startTime: number,
  pauseVideo: () => void,
  resumeVideo: () => void
) {
  const [freezeActiveId, setFreezeActiveId] = useState<string | null>(null);
  const [freezeRemaining, setFreezeRemaining] = useState<number>(0);
  const [triggeredFreezeIds, setTriggeredFreezeIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);

  const clearFreezeTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Reset triggers when we are near the starting boundary (e.g. looping back)
  useEffect(() => {
    if (currentTime <= startTime + 0.1) {
      setTriggeredFreezeIds(new Set());
    }
  }, [currentTime, startTime]);

  // Check if a freeze point has been hit
  useEffect(() => {
    if (freezeActiveId) return;

    const freezes = annotations.filter((a) => a.type === "freeze");
    for (const f of freezes) {
      if (f.type !== "freeze") continue;

      const timeDiff = Math.abs(currentTime - f.time);
      // Trigger if we are close to the mark, haven't triggered in this pass, and not already frozen
      if (timeDiff < 0.25 && !triggeredFreezeIds.has(f.id)) {
        pauseVideo();
        setFreezeActiveId(f.id);
        setFreezeRemaining(f.duration);
        
        setTriggeredFreezeIds((prev) => {
          const next = new Set(prev);
          next.add(f.id);
          return next;
        });
        break;
      }
    }
  }, [currentTime, annotations, freezeActiveId, triggeredFreezeIds, pauseVideo]);

  // Handle the freeze countdown ticks
  useEffect(() => {
    if (freezeRemaining <= 0) {
      if (freezeActiveId) {
        setFreezeActiveId(null);
        resumeVideo();
      }
      return;
    }

    clearFreezeTimer();
    timerRef.current = window.setTimeout(() => {
      setFreezeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearFreezeTimer();
  }, [freezeRemaining, freezeActiveId, resumeVideo]);

  const resetFreeze = () => {
    clearFreezeTimer();
    setFreezeActiveId(null);
    setFreezeRemaining(0);
    setTriggeredFreezeIds(new Set());
  };

  return {
    freezeActiveId,
    freezeRemaining,
    resetFreeze,
    triggeredFreezeIds,
    setTriggeredFreezeIds,
  };
}
