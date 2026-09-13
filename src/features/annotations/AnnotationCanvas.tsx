/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import type { Annotation } from "../../types";
import { renderAnnotations } from "../../export/renderAnnotations";
import { getDisplayedVideoBounds, type VideoBounds } from "../../utils/videoUtils";

interface AnnotationCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  annotations: Annotation[];
  time: number;
  zIndexClassName?: string;
}

// Draws annotations over the visible area of a contain-fitted <video> with the same renderer the
// export uses, so the preview matches the exported clip. It never receives pointer events.
export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({ videoRef, annotations, time, zIndexClassName = "z-10" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bounds, setBounds] = useState<VideoBounds | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = video?.parentElement;
    if (!video || !container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      setBounds(getDisplayedVideoBounds(rect.width, rect.height, video.videoWidth, video.videoHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    video.addEventListener("loadedmetadata", update);
    return () => {
      observer.disconnect();
      video.removeEventListener("loadedmetadata", update);
    };
  }, [videoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    renderAnnotations(ctx, width, height, annotations, time);
  }, [bounds, annotations, time]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="annotation-canvas"
      aria-hidden="true"
      className={`absolute pointer-events-none ${zIndexClassName}`}
      style={bounds ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } : { display: "none" }}
    />
  );
};
