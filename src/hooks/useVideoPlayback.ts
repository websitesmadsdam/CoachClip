/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Documented exceptions: useVideoPlayback hook contains unused helper arguments matching system lifecycle standards.
 */

import { useEffect, useState, useRef } from "react";
import { clampTime } from "../utils/videoUtils";

export function useVideoPlayback(
  videoUrl: string,
  startTime: number,
  endTime: number,
  onTimeUpdateCallback?: (currentTime: number) => void
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [playbackRate, setPlaybackRate] = useState(1);
  const rafRef = useRef<number | null>(null);

  // Sync starting time
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [startTime, videoUrl]);

  // Adjust playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Animation frame loop for precise time tracking and boundary limits
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const checkTime = () => {
      const current = video.currentTime;
      setCurrentTime(current);
      if (onTimeUpdateCallback) {
        onTimeUpdateCallback(current);
      }

      // Enforce end of clip boundaries
      if (current >= endTime) {
        video.currentTime = startTime;
        setCurrentTime(startTime);
        if (onTimeUpdateCallback) {
          onTimeUpdateCallback(startTime);
        }
      } else if (current < startTime) {
        video.currentTime = startTime;
        setCurrentTime(startTime);
        if (onTimeUpdateCallback) {
          onTimeUpdateCallback(startTime);
        }
      }

      if (isPlaying) {
        rafRef.current = requestAnimationFrame(checkTime);
      }
    };

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
      rafRef.current = requestAnimationFrame(checkTime);
    } else {
      video.pause();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, startTime, endTime, onTimeUpdateCallback]);

  const togglePlay = () => setIsPlaying((prev) => !prev);
  const pause = () => setIsPlaying(false);
  const play = () => setIsPlaying(true);

  const seekRelative = (seconds: number, maxDuration: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = clampTime(video.currentTime + seconds, endTime, startTime);
    video.currentTime = target;
    setCurrentTime(target);
    if (onTimeUpdateCallback) {
      onTimeUpdateCallback(target);
    }
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = clampTime(time, endTime, startTime);
    video.currentTime = target;
    setCurrentTime(target);
    if (onTimeUpdateCallback) {
      onTimeUpdateCallback(target);
    }
  };

  return {
    videoRef,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    playbackRate,
    setPlaybackRate,
    togglePlay,
    pause,
    play,
    seekRelative,
    seekTo,
  };
}
