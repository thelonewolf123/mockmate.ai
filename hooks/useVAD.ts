"use client";

import { useCallback, useRef, useState } from "react";

interface MicVADInstance {
  start: () => void;
  pause: () => void;
  destroy: () => void;
}

interface VADModule {
  MicVAD: {
    new: (options: {
      onSpeechStart?: () => void;
      onSpeechEnd?: (audio: Float32Array) => void;
      onnxWASMBasePath?: string;
      baseAssetPath?: string;
    }) => Promise<MicVADInstance>;
  };
}

declare global {
  interface Window {
    vad: VADModule;
  }
}

interface UseVADOptions {
  onSpeechStart?: () => void;
  onSpeechEnd?: (audio: Float32Array) => void;
}

export function useVAD({ onSpeechStart, onSpeechEnd }: UseVADOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const vadRef = useRef<MicVADInstance | null>(null);

  const start = useCallback(async () => {
    if (vadRef.current) return;

    setIsLoading(true);
    try {
      const vadInstance = await window.vad.MicVAD.new({
        onSpeechStart,
        onSpeechEnd,
        onnxWASMBasePath:
          "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
        baseAssetPath:
          "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/"
      });

      vadInstance.start();
      vadRef.current = vadInstance;
      setIsListening(true);
    } finally {
      setIsLoading(false);
    }
  }, [onSpeechStart, onSpeechEnd]);

  const stop = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
      setIsListening(false);
    }
  }, []);

  return { isListening, isLoading, start, stop };
}
