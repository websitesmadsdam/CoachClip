/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Page } from "@playwright/test";

export const TEST_VIDEO = {
  path: "public/demo_basketball_video.mp4",
  durationSeconds: 8,
  trimStart: 1,
  trimEnd: 6,
  freezeTime: 3,
  freezeDuration: 3,
};

export type ExportCreateObservation = {
  requestUrl: string;
  requestMethod: string;
  status: number;
  responseBody: string;
  contentType: string | null;
};

export async function waitForExportCreation(
  page: Page
): Promise<ExportCreateObservation> {
  const response = await page.waitForResponse(candidate => {
    try {
      const url = new URL(candidate.url());
      return (
        candidate.request().method() === "POST" &&
        url.pathname === "/api/exports"
      );
    } catch {
      return false;
    }
  });

  return {
    requestUrl: response.url(),
    requestMethod: response.request().method(),
    status: response.status(),
    responseBody: await response.text(),
    contentType: response.headers()["content-type"] ?? null,
  };
}
