"use client";

import { useCallback, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Mic, MicOff, PhoneOff, Loader2, Bot, User } from "lucide-react";
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
  const [userText, setUserText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const log = useCallback((msg: string) => {
    setLogs((prev) => [msg, ...prev].slice(0, 50));
  }, []);

  const { messages, sendMessage } = useChat({
    onFinish: async ({ message }) => {
      log("🤖 GPT ready. Speaking...");
      setIsAiSpeaking(true);
      try {
        const text = getMessageText(message);
        const audioBlob = await speak(text, OPENAI_API_KEY);
        if (audioRef.current) {
          audioRef.current.src = URL.createObjectURL(audioBlob);
          audioRef.current.onended = () => setIsAiSpeaking(false);
          audioRef.current.play();
        }
      } catch (err) {
        log(`❌ TTS Error: ${err instanceof Error ? err.message : err}`);
        setIsAiSpeaking(false);
      } finally {
        setIsSpeaking(false);
      }
    },
    onError: (err) => {
      log(`❌ Chat Error: ${err.message}`);
      setIsSpeaking(false);
      setIsAiSpeaking(false);
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

        sendMessage({
          role: "user",
          parts: [{ type: "text", text }]
        });
      } catch (err) {
        log(`❌ Error: ${err instanceof Error ? err.message : err}`);
        setIsSpeaking(false);
      }
    },
    [isSpeaking, log, sendMessage]
  );

  const { isListening, isLoading, start, stop } = useVAD({
    onSpeechStart: () => log("🟡 Speaking..."),
    onSpeechEnd: handleSpeechEnd
  });

  const handleToggle = async () => {
    if (isListening) {
      stop();
    } else {
      if (!OPENAI_API_KEY) {
        alert("Set NEXT_PUBLIC_OPENAI_API_KEY in .env.local");
        return;
      }
      log("🎤 Starting mic + VAD...");
      await start();
      log("✅ Listening...");
    }
  };

  const assistantMessage = messages.filter((m) => m.role === "assistant").pop();
  const assistantText = assistantMessage
    ? getMessageText(assistantMessage)
    : "";

  return (
    <div className="flex flex-col h-screen w-full bg-[#202124]">
      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center p-4 gap-4">
        {/* AI Avatar Card */}
        <div className="relative flex-1 max-w-xl aspect-video bg-[#3c4043] rounded-xl overflow-hidden flex items-center justify-center">
          <div
            className={`flex flex-col items-center justify-center transition-all duration-300 ${
              isAiSpeaking ? "scale-105" : ""
            }`}
          >
            <div
              className={`w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 ${
                isAiSpeaking
                  ? "ring-4 ring-blue-400 ring-opacity-75 animate-pulse"
                  : ""
              }`}
            >
              <Bot className="w-12 h-12 text-white" />
            </div>
            <span className="text-white text-lg font-medium">AI Assistant</span>
            {isAiSpeaking && (
              <span className="text-blue-400 text-sm mt-1">Speaking...</span>
            )}
          </div>

          {assistantText && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4">
              <p className="text-white text-center text-sm line-clamp-2">
                {assistantText}
              </p>
            </div>
          )}
        </div>

        {/* User Card */}
        <div className="relative flex-1 max-w-xl aspect-video bg-[#3c4043] rounded-xl overflow-hidden flex items-center justify-center">
          <div
            className={`flex flex-col items-center justify-center transition-all duration-300 ${
              isSpeaking ? "scale-105" : ""
            }`}
          >
            <div
              className={`w-24 h-24 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center mb-4 ${
                isListening && !isSpeaking ? "ring-2 ring-green-400" : ""
              } ${isSpeaking ? "ring-4 ring-green-400 animate-pulse" : ""}`}
            >
              <User className="w-12 h-12 text-white" />
            </div>
            <span className="text-white text-lg font-medium">You</span>
            {isSpeaking && (
              <span className="text-green-400 text-sm mt-1">Speaking...</span>
            )}
          </div>

          {userText && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4">
              <p className="text-white text-center text-sm line-clamp-2">
                {userText}
              </p>
            </div>
          )}

          {isListening && (
            <div className="absolute top-3 right-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="flex items-center justify-center gap-4 p-6 bg-[#202124]">
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
            isListening
              ? "bg-red-500 hover:bg-red-600"
              : "bg-[#3c4043] hover:bg-[#4a4f54]"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : isListening ? (
            <Mic className="w-6 h-6 text-white" />
          ) : (
            <MicOff className="w-6 h-6 text-white" />
          )}
        </button>

        <button
          onClick={() => window.location.reload()}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
        >
          <PhoneOff className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-6 py-2 bg-[#292a2d] text-gray-400 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isListening ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span>{isListening ? "Connected" : "Click mic to start"}</span>
        </div>
        <div className="max-w-md truncate">{logs[0] || "Ready"}</div>
      </div>

      <audio ref={audioRef} />
    </div>
  );
}
