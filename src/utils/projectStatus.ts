/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoachClipProject } from "../types";

// Only an explicit "exported" counts; older versions also stored server states like "expired".
export function isProjectExported(project: Pick<CoachClipProject, "exportStatus" | "export">): boolean {
  return project.export?.status === "exported" || project.exportStatus === "exported";
}

// Source videos are never stored, so a project can only be opened with the same file picked again.
export function hasMatchingSource(file: File | null, project: Pick<CoachClipProject, "sourceVideo">): boolean {
  return !!file && file.name === project.sourceVideo.fileName && file.size === project.sourceVideo.size;
}
