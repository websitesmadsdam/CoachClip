import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const outputDir = path.resolve("tmp/e2e");
const outputFile = path.join(outputDir, "demo_test_video.mp4");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`[generateE2EVideo] Generating deterministic E2E test video at ${outputFile}...`);

const ffmpegCmd = [
  "ffmpeg",
  "-y",
  "-f lavfi -i testsrc=size=640x360:rate=30",
  "-f lavfi -i anullsrc=r=48000:cl=stereo",
  "-t 8",
  "-c:v libx264 -pix_fmt yuv420p",
  "-c:a aac -ar 48000 -ac 2",
  "-movflags +faststart",
  `"${outputFile}"`
].join(" ");

try {
  execSync(ffmpegCmd, { stdio: "inherit" });
  console.log(`[generateE2EVideo] Successfully generated ${outputFile}`);
} catch (error) {
  console.error("[generateE2EVideo] Failed to generate test video:", error);
  process.exit(1);
}
