import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const openai = createOpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
  });

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: convertToModelMessages(messages)
  });

  return result.toUIMessageStreamResponse();
}
