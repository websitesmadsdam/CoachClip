/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { FfmpegExportService } from "../server/src/services/ffmpegExportService";

function comparePngs(img1Path: string, img2Path: string): { diffPixels: number; width: number; height: number } {
  const img1 = PNG.sync.read(fs.readFileSync(img1Path));
  const img2 = PNG.sync.read(fs.readFileSync(img2Path));

  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(`Images must be of same dimensions: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`);
  }

  const { width, height } = img1;
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  return { diffPixels, width, height };
}

async function runTextSmokeTest() {
  const inputPath = path.resolve("test_input_text.mp4");
  const refPath = path.resolve("test_output_text_ref.mp4");
  const annotatedPath = path.resolve("test_output_text_annotated.mp4");
  const tempDir = path.resolve("./tmp/text_test_temp");

  console.log("--- STARTING SMOKE TEST: TEXT ANNOTATIONS ---");

  // Cleanup potential leftover files
  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(refPath)) fs.unlinkSync(refPath);
  if (fs.existsSync(annotatedPath)) fs.unlinkSync(annotatedPath);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 1. Generate synthetic test video: 6s duration, 640x360, H.264 video, AAC audio
    console.log("Step 1: Generating synthetic test video...");
    execSync(
      `ffmpeg -f lavfi -i testsrc=duration=6:size=640x360:rate=30 -f lavfi -i "sine=frequency=1000:duration=6" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -y "${inputPath}"`,
      { stdio: "ignore" }
    );
    console.log("Synthetic video generated at:", inputPath);

    const refInput = path.resolve("test_input_text_ref.mp4");
    const annoInput = path.resolve("test_input_text_anno.mp4");
    fs.copyFileSync(inputPath, refInput);
    fs.copyFileSync(inputPath, annoInput);

    // 2. Extract metadata
    console.log("Step 2: Probing synthetic video metadata...");
    const metadata = await FfmpegExportService.getVideoDimensions(refInput);
    console.log("Input Metadata:", metadata);

    // 3. Export reference clip (no annotations)
    console.log("Step 3: Exporting reference clip (no annotations)...");
    const refMetadata = {
      projectId: "ref_text_project",
      clip: { startTime: 1.0, endTime: 5.0 },
      annotations: [] as any[]
    };
    await FfmpegExportService.executeExport("ref-text-job", refMetadata as any, refInput, refPath, tempDir);

    // 4. Export annotated clip
    console.log("Step 4: Exporting annotated clip with text: 'Kom tidligere ind – æøå ÆØÅ'...");
    const annotatedMetadata = {
      projectId: "annotated_text_project",
      clip: { startTime: 1.0, endTime: 5.0 },
      annotations: [
        {
          id: "t1",
          type: "text",
          text: "Kom tidligere ind – æøå ÆØÅ",
          x: 0.5,
          y: 0.5,
          startTime: 2.0,
          endTime: 4.0,
          size: "normal",
          color: "white"
        }
      ] as any[]
    };
    await FfmpegExportService.executeExport("annotated-text-job", annotatedMetadata as any, annoInput, annotatedPath, tempDir);

    // 5. Extract frames at multiple times: before (1.5s), during (3.0s), after (4.5s)
    // Remember timestamps are relative to output, which starts at start=1.0s.
    // So 1.5s in original is 0.5s in output.
    // 3.0s in original is 2.0s in output.
    // 4.5s in original is 3.5s in output.
    console.log("Step 5: Extracting frames for visual validation...");
    const refBeforePng = path.join(tempDir, "ref_before.png");
    const annoBeforePng = path.join(tempDir, "anno_before.png");
    const refDuringPng = path.join(tempDir, "ref_during.png");
    const annoDuringPng = path.join(tempDir, "anno_during.png");
    const refAfterPng = path.join(tempDir, "ref_after.png");
    const annoAfterPng = path.join(tempDir, "anno_after.png");

    execSync(`ffmpeg -ss 0.5 -i "${refPath}" -vframes 1 -y "${refBeforePng}"`, { stdio: "ignore" });
    execSync(`ffmpeg -ss 0.5 -i "${annotatedPath}" -vframes 1 -y "${annoBeforePng}"`, { stdio: "ignore" });

    execSync(`ffmpeg -ss 2.0 -i "${refPath}" -vframes 1 -y "${refDuringPng}"`, { stdio: "ignore" });
    execSync(`ffmpeg -ss 2.0 -i "${annotatedPath}" -vframes 1 -y "${annoDuringPng}"`, { stdio: "ignore" });

    execSync(`ffmpeg -ss 3.5 -i "${refPath}" -vframes 1 -y "${refAfterPng}"`, { stdio: "ignore" });
    execSync(`ffmpeg -ss 3.5 -i "${annotatedPath}" -vframes 1 -y "${annoAfterPng}"`, { stdio: "ignore" });

    // Compare frames
    console.log("Step 6: Comparing frames pixelmæssigt...");
    const beforeDiff = comparePngs(refBeforePng, annoBeforePng);
    const duringDiff = comparePngs(refDuringPng, annoDuringPng);
    const afterDiff = comparePngs(refAfterPng, annoAfterPng);

    console.log(`Before annotation start window (0.5s): diff pixels = ${beforeDiff.diffPixels}`);
    console.log(`During annotation window (2.0s): diff pixels = ${duringDiff.diffPixels}`);
    console.log(`After annotation end window (3.5s): diff pixels = ${afterDiff.diffPixels}`);

    if (beforeDiff.diffPixels > 15) {
      throw new Error(`Expected NO visual differences before text start, but got ${beforeDiff.diffPixels} diff pixels.`);
    }

    if (duringDiff.diffPixels === 0) {
      throw new Error(`Expected text to be visible and have a measurable difference in the during-frame, but got 0 diff pixels.`);
    }

    if (afterDiff.diffPixels > 15) {
      throw new Error(`Expected NO visual differences after text end, but got ${afterDiff.diffPixels} diff pixels.`);
    }

    // Check that background is still visible (it is not a fully corrupted or black screen)
    const totalPixels = duringDiff.width * duringDiff.height;
    const diffPercentage = (duringDiff.diffPixels / totalPixels) * 100;
    console.log(`Text overlay affected area: ${diffPercentage.toFixed(2)}% of the screen`);
    if (diffPercentage > 40) {
      throw new Error(`Text overlay is affecting too much of the screen (${diffPercentage.toFixed(2)}%), indicating background corruption.`);
    }

    console.log("\n--- SMOKE TEST: TEXT ANNOTATIONS PASSED SUCCESSFULLY! ---");
  } catch (err: any) {
    console.error("\n--- SMOKE TEST: TEXT ANNOTATIONS FAILED! ---");
    console.error(err);
    process.exit(1);
  } finally {
    console.log("Step 7: Cleaning up test files...");
    const refInput = path.resolve("test_input_text_ref.mp4");
    const annoInput = path.resolve("test_input_text_anno.mp4");
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(refInput)) fs.unlinkSync(refInput);
    if (fs.existsSync(annoInput)) fs.unlinkSync(annoInput);
    if (fs.existsSync(refPath)) fs.unlinkSync(refPath);
    if (fs.existsSync(annotatedPath)) fs.unlinkSync(annotatedPath);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("Cleanup complete.");
  }
}

runTextSmokeTest();
