"use client";

import { useCallback, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useVAD } from "./useVAD";
import { useSpeech } from "./useSpeech";
import { encodeWAV } from "../lib/audio";

function getMessageText(message: {
  parts: Array<{ type: string; text?: string }>;
}): string {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text"
    )
    .map((part) => part.text)
    .join("");
}

interface UseVoiceChatOptions {
  onLog?: (message: string) => void;
}

export function useVoiceChat({ onLog }: UseVoiceChatOptions = {}) {
  const [userText, setUserText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const log = useCallback(
    (msg: string) => {
      onLog?.(msg);
    },
    [onLog]
  );

  const {
    transcribe,
    speak,
    stopSpeaking,
    isTranscribing,
    isSpeaking: isAiSpeaking
  } = useSpeech({
    onTranscribed: (text) => log(`✅ STT: ${text}`),
    onSpeakStart: () => log("🔊 AI speaking..."),
    onSpeakEnd: () => log("🔇 AI finished speaking"),
    onError: (error) => log(`❌ ${error}`)
  });

  const { messages, sendMessage } = useChat({
    onFinish: async ({ message }) => {
      log("🤖 GPT ready. Speaking...");
      const text = getMessageText(message);
      await speak(text);
      setIsProcessing(false);
    },
    onError: (err) => {
      log(`❌ Chat Error: ${err.message}`);
      setIsProcessing(false);
    }
  });

  const handleSpeechEnd = useCallback(
    async (audio: Float32Array) => {
      if (isProcessing) return;

      setIsProcessing(true);
      try {
        const wav = encodeWAV(audio);
        const text = await transcribe(wav);

        if (text) {
          setUserText(text);
          sendMessage({
            role: "user",
            parts: [{ type: "text", text }]
          });
        } else {
          setIsProcessing(false);
        }
      } catch {
        setIsProcessing(false);
      }
    },
    [isProcessing, transcribe, sendMessage]
  );

  const {
    isListening,
    isLoading: isVADLoading,
    start: startVAD,
    stop: stopVAD
  } = useVAD({
    onSpeechStart: () => log("🟡 Speaking..."),
    onSpeechEnd: handleSpeechEnd
  });

  const start = useCallback(async () => {
    log("🎤 Starting mic + VAD...");
    await startVAD();
    log("✅ Listening...");
  }, [startVAD, log]);

  const stop = useCallback(() => {
    stopVAD();
    stopSpeaking();
    log("🛑 Stopped");
  }, [stopVAD, stopSpeaking, log]);

  const assistantMessage = messages.filter((m) => m.role === "assistant").pop();
  const assistantText = assistantMessage
    ? getMessageText(assistantMessage)
    : "";

  return {
    // State
    userText,
    assistantText,
    messages,

    // Status flags
    isListening,
    isVADLoading,
    isTranscribing,
    isProcessing,
    isAiSpeaking,

    // Actions
    start,
    stop
  };
}
