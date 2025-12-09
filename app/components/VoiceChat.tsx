"use client";

import { useCallback, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useVAD } from "../hooks/useVAD";
import { encodeWAV } from "../lib/audio";
import { transcribe, speak } from "../lib/openai";

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

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";

export function VoiceChat() {
  const [userText, setUserText] = useState("—");
  const [logs, setLogs] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const log = useCallback((msg: string) => {
    setLogs((prev) => [msg, ...prev].slice(0, 50));
  }, []);

  const { messages, setMessages } = useChat({
    onFinish: async ({ message }) => {
      log("🤖 GPT ready. Speaking...");
      try {
        const text = getMessageText(message);
        const audioBlob = await speak(text, OPENAI_API_KEY);
        if (audioRef.current) {
          audioRef.current.src = URL.createObjectURL(audioBlob);
          audioRef.current.play();
        }
      } catch (err) {
        log(`❌ TTS Error: ${err instanceof Error ? err.message : err}`);
      } finally {
        setIsSpeaking(false);
      }
    },
    onError: (err) => {
      log(`❌ Chat Error: ${err.message}`);
      setIsSpeaking(false);
    }
  });

  const handleSpeechEnd = useCallback(
    async (audio: Float32Array) => {
      if (!OPENAI_API_KEY || isSpeaking) return;

      setIsSpeaking(true);
      try {
        const wav = encodeWAV(audio);
        const text = await transcribe(wav, OPENAI_API_KEY);

        setUserText(text);
        log(`✅ STT: ${text}`);

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            parts: [{ type: "text", text }]
          }
        ]);
      } catch (err) {
        log(`❌ Error: ${err instanceof Error ? err.message : err}`);
        setIsSpeaking(false);
      }
    },
    [isSpeaking, log, setMessages]
  );

  const { isListening, isLoading, start, stop } = useVAD({
    onSpeechStart: () => log("🟡 Speaking..."),
    onSpeechEnd: handleSpeechEnd
  });

  const handleStart = async () => {
    if (!OPENAI_API_KEY) {
      alert("Set NEXT_PUBLIC_OPENAI_API_KEY in .env.local");
      return;
    }
    log("🎤 Starting mic + VAD...");
    await start();
    log("✅ Listening...");
  };

  const assistantMessage = messages.filter((m) => m.role === "assistant").pop();

  return (
    <div className="w-full max-w-[700px] bg-slate-950 border border-gray-800 p-6 rounded-2xl">
      <h2 className="text-xl font-semibold mb-4">
        🎙️ Realtime Voice AI (Frontend Only)
      </h2>

      <button
        onClick={isListening ? stop : handleStart}
        disabled={isLoading}
        className="w-full mt-3 p-2 rounded-lg bg-green-500 text-black font-semibold cursor-pointer disabled:opacity-50"
      >
        {isLoading
          ? "Loading..."
          : isListening
          ? "Stop Listening"
          : "Start Listening"}
      </button>

      <div className="mt-3 p-3 border border-gray-800 rounded-xl min-h-20">
        <b>You said:</b>
        <div className="mt-1 text-gray-300">{userText}</div>
      </div>

      <div className="mt-3 p-3 border border-gray-800 rounded-xl min-h-20">
        <b>Assistant:</b>
        <div className="mt-1 text-gray-300 whitespace-pre-wrap">
          {assistantMessage ? getMessageText(assistantMessage) : "—"}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500 max-h-36 overflow-y-auto">
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>

      <audio ref={audioRef} />
    </div>
  );
}
