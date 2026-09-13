/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ExportErrorCode =
  | "UNSUPPORTED_BROWSER"
  | "UNREADABLE_VIDEO"
  | "INVALID_PROJECT"
  | "STORAGE_FULL"
  | "INTERRUPTED"
  | "CANCELLED"
  | "UNKNOWN";

export const EXPORT_ERROR_MESSAGES: Record<ExportErrorCode, string> = {
  UNSUPPORTED_BROWSER:
    "Din browser kan ikke lave klip. Opdatér til iOS 26 eller nyere, eller brug Chrome, Edge eller Safari på en computer.",
  UNREADABLE_VIDEO: "Videoen kan ikke læses i denne browser. Prøv en anden video eller en anden browser.",
  INVALID_PROJECT: "Klippet kunne ikke oprettes, fordi projektets indstillinger er ugyldige.",
  STORAGE_FULL: "Der er ikke plads nok på enheden til klippet. Frigør plads, og prøv igen.",
  INTERRUPTED: "Eksporten stoppede, fordi skærmen blev slukket eller appen lukket. Prøv igen, og hold skærmen tændt.",
  CANCELLED: "Eksporten blev afbrudt.",
  UNKNOWN: "Klippet kunne ikke oprettes. Projektet og dine markeringer er dog stadig gemt.",
};

export const AUDIO_WARNING_MESSAGE = "Klippet er lavet uden lyd, fordi lyden i videoen ikke kunne læses.";

export class ExportError extends Error {
  readonly code: ExportErrorCode;

  constructor(code: ExportErrorCode, options: { message?: string; cause?: unknown } = {}) {
    super(options.message ?? EXPORT_ERROR_MESSAGES[code], { cause: options.cause });
    this.name = "ExportError";
    this.code = code;
  }
}

const hasName = (error: unknown, name: string) =>
  typeof error === "object" && error !== null && (error as { name?: unknown }).name === name;

export function toExportError(error: unknown, context: { cancelled: boolean; wasHidden: boolean }): ExportError {
  if (error instanceof ExportError) return error;
  if (context.cancelled) return new ExportError("CANCELLED", { cause: error });
  if (hasName(error, "QuotaExceededError")) return new ExportError("STORAGE_FULL", { cause: error });
  if (context.wasHidden) return new ExportError("INTERRUPTED", { cause: error });
  return new ExportError("UNKNOWN", { cause: error });
}
