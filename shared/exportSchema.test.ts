import { describe, it, expect } from "vitest";
import { sanitizeExportFileName } from "./exportSchema";

describe("sanitizeExportFileName", () => {
  it("replaces Danish characters and punctuation", () => {
    expect(sanitizeExportFileName("Træning og øvelse på Åen")).toBe("Traening_og_oevelse_paa_Aaen.mp4");
    expect(sanitizeExportFileName("   Spiller 1 - Skud! ???   ")).toBe("Spiller_1_-_Skud.mp4");
    expect(sanitizeExportFileName("Spillerens' skud")).toBe("Spillerens_skud.mp4");
  });

  it("strips path traversal and separators", () => {
    expect(sanitizeExportFileName("../../etc/passwd")).toBe("etcpasswd.mp4");
    expect(sanitizeExportFileName("test/../../../file")).toBe("testfile.mp4");
    expect(sanitizeExportFileName("C:\\Windows\\system32")).toBe("CWindowssystem32.mp4");
  });

  it("limits length and falls back for empty titles", () => {
    const long = sanitizeExportFileName("a".repeat(200));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith(".mp4")).toBe(true);
    expect(sanitizeExportFileName("")).toBe("CoachClip.mp4");
    expect(sanitizeExportFileName("   ")).toBe("CoachClip.mp4");
  });

  it("prefixes Windows reserved names", () => {
    expect(sanitizeExportFileName("CON")).toBe("_CON.mp4");
    expect(sanitizeExportFileName("PRN")).toBe("_PRN.mp4");
    expect(sanitizeExportFileName("AUX")).toBe("_AUX.mp4");
    expect(sanitizeExportFileName("NUL")).toBe("_NUL.mp4");
  });
});
