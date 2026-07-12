/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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

async function runArrowSmokeTest() {
  const inputPath = path.resolve("test_input_arrow.mp4");
  const refPath = path.resolve("test_output_arrow_ref.mp4");
  const annotatedPath = path.resolve("test_output_arrow_annotated.mp4");
  const tempDir = path.resolve("./tmp/arrow_test_temp");

  console.log("--- STARTING SMOKE TEST: ARROW ANNOTATIONS ---");

  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  if (fs.existsSync(refPath)) fs.unlinkSync(refPath);
  if (fs.existsSync(annotatedPath)) fs.unlinkSync(annotatedPath);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    console.log("Step 1: Generating synthetic test video...");
    execSync(
      `ffmpeg -f lavfi -i testsrc=duration=6:size=640x360:rate=30 -f lavfi -i "sine=frequency=1000:duration=6" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -y "${inputPath}"`,
      { stdio: "ignore" }
    );

    const refInput = path.resolve("test_input_arrow_ref.mp4");
    const annoInput = path.resolve("test_input_arrow_anno.mp4");
    fs.copyFileSync(inputPath, refInput);
    fs.copyFileSync(inputPath, annoInput);

    console.log("Step 2: Probing synthetic video metadata...");
    const metadata = await FfmpegExportService.getVideoDimensions(refInput);

    console.log("Step 3: Exporting reference clip...");
    const refMetadata = {
      projectId: "ref_arrow_project",
      clip: { startTime: 1.0, endTime: 5.0 },
      annotations: []
    };
    await FfmpegExportService.executeExport("ref-arrow-job", refMetadata as any, refInput, refPath, tempDir);

    console.log("Step 4: Exporting annotated clip with red arrow starting at 0.1, 0.1 and ending at 0.8, 0.8...");
    const annotatedMetadata = {
      projectId: "annotated_arrow_project",
      clip: { startTime: 1.0, endTime: 5.0 },
      annotations: [
        {
          id: "a1",
          type: "arrow",
          startX: 0.1,
          startY: 0.1,
          endX: 0.8,
          endY: 0.8,
          startTime: 2.0,
          endTime: 4.0,
          color: "red"
        }
      ]
    };
    await FfmpegExportService.executeExport("annotated-arrow-job", annotatedMetadata as any, annoInput, annotatedPath, tempDir);

    console.log("Step 5: Extracting frames...");
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

    console.log("Step 6: Comparing frames pixelmæssigt...");
    const beforeDiff = comparePngs(refBeforePng, annoBeforePng);
    const duringDiff = comparePngs(refDuringPng, annoDuringPng);
    const afterDiff = comparePngs(refAfterPng, annoAfterPng);

    console.log(`Before window (0.5s): diff pixels = ${beforeDiff.diffPixels}`);
    console.log(`During window (2.0s): diff pixels = ${duringDiff.diffPixels}`);
    console.log(`After window (3.5s): diff pixels = ${afterDiff.diffPixels}`);

    if (beforeDiff.diffPixels > 15) {
      throw new Error(`Expected NO visual differences before arrow start, but got ${beforeDiff.diffPixels} diff pixels.`);
    }

    if (duringDiff.diffPixels === 0) {
      throw new Error(`Expected arrow to be visible, but got 0 diff pixels.`);
    }

    if (afterDiff.diffPixels > 15) {
      throw new Error(`Expected NO visual differences after arrow end, but got ${afterDiff.diffPixels} diff pixels.`);
    }

    const totalPixels = duringDiff.width * duringDiff.height;
    const diffPercentage = (duringDiff.diffPixels / totalPixels) * 100;
    console.log(`Arrow overlay affected area: ${diffPercentage.toFixed(2)}% of the screen`);
    if (diffPercentage > 20) {
      throw new Error(`Arrow overlay is affecting too much of the screen (${diffPercentage.toFixed(2)}%).`);
    }

    console.log("\n--- SMOKE TEST: ARROW ANNOTATIONS PASSED SUCCESSFULLY! ---");
  } catch (err: any) {
    console.error("\n--- SMOKE TEST: ARROW ANNOTATIONS FAILED! ---");
    console.error(err);
    process.exit(1);
  } finally {
    console.log("Step 7: Cleaning up...");
    const refInput = path.resolve("test_input_arrow_ref.mp4");
    const annoInput = path.resolve("test_input_arrow_anno.mp4");
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(refInput)) fs.unlinkSync(refInput);
    if (fs.existsSync(annoInput)) fs.unlinkSync(annoInput);
    if (fs.existsSync(refPath)) fs.unlinkSync(refPath);
    if (fs.existsSync(annotatedPath)) fs.unlinkSync(annotatedPath);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runArrowSmokeTest();
