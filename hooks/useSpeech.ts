"use client";

import { useCallback, useRef, useState } from "react";

interface UseSpeechOptions {
  onTranscribed?: (text: string) => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  onError?: (error: string) => void;
}

export function useSpeech({
  onTranscribed,
  onSpeakStart,
  onSpeakEnd,
  onError
}: UseSpeechOptions = {}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudioElement = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  }, []);

  const transcribe = useCallback(
    async (audioBlob: Blob): Promise<string | null> => {
      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "speech.webm");

        const response = await fetch("/api/speech/transcribe", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Transcription failed");
        }

        const data = await response.json();
        onTranscribed?.(data.text);
        return data.text;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        onError?.(`Transcription error: ${message}`);
        return null;
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscribed, onError]
  );

  const speak = useCallback(
    async (text: string): Promise<void> => {
      setIsSpeaking(true);
      onSpeakStart?.();

      try {
        const response = await fetch("/api/speech/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "TTS failed");
        }

        const audioBlob = await response.blob();
        const audio = getAudioElement();
        audio.src = URL.createObjectURL(audioBlob);

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Audio playback failed"));
          audio.play().catch(reject);
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        onError?.(`TTS error: ${message}`);
      } finally {
        setIsSpeaking(false);
        onSpeakEnd?.();
      }
    },
    [getAudioElement, onSpeakStart, onSpeakEnd, onError]
  );

  const stopSpeaking = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsSpeaking(false);
      onSpeakEnd?.();
    }
  }, [onSpeakEnd]);

  return {
    transcribe,
    speak,
    stopSpeaking,
    isTranscribing,
    isSpeaking
  };
}
