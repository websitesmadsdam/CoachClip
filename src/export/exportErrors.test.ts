import { describe, it, expect } from "vitest";
import { ExportError, toExportError, EXPORT_ERROR_MESSAGES } from "./exportErrors";

describe("ExportError", () => {
  it("uses the Danish message for its code by default", () => {
    const error = new ExportError("STORAGE_FULL");
    expect(error.code).toBe("STORAGE_FULL");
    expect(error.message).toBe("Der er ikke plads nok på enheden til klippet. Frigør plads, og prøv igen.");
    expect(error.name).toBe("ExportError");
  });

  it("accepts a custom message and cause", () => {
    const cause = new Error("inner");
    const error = new ExportError("INVALID_PROJECT", { message: "Det valgte klip skal være mindst 0,5 sekunder.", cause });
    expect(error.message).toBe("Det valgte klip skal være mindst 0,5 sekunder.");
    expect(error.cause).toBe(cause);
  });
});

describe("toExportError", () => {
  const plain = { cancelled: false, wasHidden: false };

  it("returns an existing ExportError unchanged", () => {
    const original = new ExportError("UNREADABLE_VIDEO");
    expect(toExportError(original, { cancelled: true, wasHidden: true })).toBe(original);
  });

  it("maps to CANCELLED when the signal was aborted", () => {
    expect(toExportError(new Error("x"), { cancelled: true, wasHidden: true }).code).toBe("CANCELLED");
  });

  it("maps QuotaExceededError to STORAGE_FULL", () => {
    const quota = Object.assign(new Error("full"), { name: "QuotaExceededError" });
    expect(toExportError(quota, plain).code).toBe("STORAGE_FULL");
  });

  it("maps failures after the page was hidden to INTERRUPTED", () => {
    expect(toExportError(new Error("EncodingError"), { cancelled: false, wasHidden: true }).code).toBe("INTERRUPTED");
  });

  it("maps everything else to UNKNOWN with the reassuring message", () => {
    const error = toExportError("boom", plain);
    expect(error.code).toBe("UNKNOWN");
    expect(error.message).toBe(EXPORT_ERROR_MESSAGES.UNKNOWN);
    expect(error.cause).toBe("boom");
  });
});
