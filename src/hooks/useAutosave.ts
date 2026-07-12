/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useCallback } from "react";
import { CoachClipProject } from "../types";
import { dbService } from "../db";

export function useAutosave(
  project: CoachClipProject | null,
  onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "error") => void
) {
  const projectRef = useRef<CoachClipProject | null>(project);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const saveImmediately = useCallback(async (customProject?: CoachClipProject) => {
    const targetProject = customProject || projectRef.current;
    if (!targetProject) return;

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (onSaveStatusChange) onSaveStatusChange("saving");

    try {
      await dbService.saveProject(targetProject);
      if (onSaveStatusChange) onSaveStatusChange("saved");
    } catch (err) {
      console.error("Autosave failed:", err);
      if (onSaveStatusChange) onSaveStatusChange("error");
    }
  }, [onSaveStatusChange]);

  const triggerAutosave = useCallback((updatedProject: CoachClipProject) => {
    projectRef.current = updatedProject;
    
    if (onSaveStatusChange) onSaveStatusChange("saving");

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        await dbService.saveProject(updatedProject);
        if (onSaveStatusChange) onSaveStatusChange("saved");
      } catch (err) {
        console.error("Autosave failed:", err);
        if (onSaveStatusChange) onSaveStatusChange("error");
      }
    }, 1000);
  }, [onSaveStatusChange]);

  return {
    triggerAutosave,
    saveImmediately,
  };
}
