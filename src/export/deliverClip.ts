/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExportedClip } from "./exportClip";

export type DeliveryResult = "shared" | "downloaded" | "dismissed";

function download(file: File, fileName: string): DeliveryResult {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

// Must be called directly from a user gesture: iOS rejects share() without transient activation.
export async function deliverClip(
  clip: Pick<ExportedClip, "file" | "fileName">,
  mode: "share" | "download"
): Promise<DeliveryResult> {
  const shareFile = new File([clip.file], clip.fileName, { type: "video/mp4" });
  if (mode === "share" && navigator.canShare?.({ files: [shareFile] })) {
    try {
      await navigator.share({ files: [shareFile], title: clip.fileName });
      return "shared";
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return "dismissed";
      // For example NotAllowedError when the user gesture expired: the coach still gets the file.
      console.warn("Sharing the clip failed, downloading instead:", error);
    }
  }
  return download(clip.file, clip.fileName);
}
