import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

test.describe("CoachClip - Demo Video File Integrity", () => {
  test("verifies that user-facing demo video public/demo_basketball_video.mp4 is a valid uncorrupted MP4 video", () => {
    const demoVideoPath = path.join(process.cwd(), "public/demo_basketball_video.mp4");

    // 1. Verify existence
    expect(
      fs.existsSync(demoVideoPath),
      `KORRUMPERET DEMOVIDEO: public/demo_basketball_video.mp4 findes ikke på stien ${demoVideoPath}`
    ).toBe(true);

    // 2. Verify non-zero file size
    const stats = fs.statSync(demoVideoPath);
    expect(
      stats.size,
      `KORRUMPERET DEMOVIDEO: public/demo_basketball_video.mp4 er tom (0 bytes).`
    ).toBeGreaterThan(0);

    // 3. Probe video format and stream properties with ffprobe
    let probeOutput = "";
    try {
      probeOutput = execSync(
        `ffprobe -v error -show_entries format=format_name,duration,size -select_streams v:0 -show_entries stream=codec_name,width,height -of json "${demoVideoPath}"`
      ).toString();
    } catch (err: any) {
      throw new Error(
        `KORRUMPERET DEMOVIDEO: ffprobe fejlede ved læsning af public/demo_basketball_video.mp4.\nFejl: ${err.message}`
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(probeOutput);
    } catch {
      throw new Error("KORRUMPERET DEMOVIDEO: Kunne ikke parse JSON fra ffprobe for public/demo_basketball_video.mp4");
    }

    const format = parsed.format;
    expect(
      format,
      "KORRUMPERET DEMOVIDEO: Ingen format-metadata fundet i public/demo_basketball_video.mp4"
    ).toBeDefined();

    expect(
      format.format_name,
      `KORRUMPERET DEMOVIDEO: Ugyldigt format (${format.format_name}) for public/demo_basketball_video.mp4`
    ).toContain("mp4");

    const duration = parseFloat(format.duration);
    expect(
      duration,
      `KORRUMPERET DEMOVIDEO: Ugyldig varighed (${format.duration}s) for public/demo_basketball_video.mp4`
    ).toBeGreaterThan(0);

    const videoStream = parsed.streams?.[0];
    expect(
      videoStream,
      "KORRUMPERET DEMOVIDEO: Ingen gyldig videostream fundet i public/demo_basketball_video.mp4"
    ).toBeDefined();

    expect(
      videoStream.codec_name,
      `KORRUMPERET DEMOVIDEO: Ugyldig videocodec (${videoStream.codec_name})`
    ).toBeTruthy();

    expect(
      videoStream.width,
      `KORRUMPERET DEMOVIDEO: Ugyldig videobredde (${videoStream.width})`
    ).toBeGreaterThan(0);

    expect(
      videoStream.height,
      `KORRUMPERET DEMOVIDEO: Ugyldig videohøjde (${videoStream.height})`
    ).toBeGreaterThan(0);
  });
});
