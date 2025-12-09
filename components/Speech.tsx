"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

export interface SpeechRef {
  play: (audioBlob: Blob) => Promise<void>;
  stop: () => void;
}

interface SpeechProps {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export const Speech = forwardRef<SpeechRef, SpeechProps>(function Speech(
  { onStart, onEnd, onError },
  ref
) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useImperativeHandle(ref, () => ({
    play: async (audioBlob: Blob) => {
      const audio = audioRef.current;
      if (!audio) return;

      onStart?.();
      audio.src = URL.createObjectURL(audioBlob);

      return new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          onEnd?.();
          resolve();
        };
        audio.onerror = () => {
          const error = "Audio playback failed";
          onError?.(error);
          reject(new Error(error));
        };
        audio.play().catch((err) => {
          onError?.(err.message);
          reject(err);
        });
      });
    },
    stop: () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        onEnd?.();
      }
    }
  }));

  return <audio ref={audioRef} />;
});
