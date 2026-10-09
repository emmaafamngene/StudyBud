import "server-only";
import type { ChatMessage } from "@/features/study/types";
import {
  DEFAULT_PREFERENCES,
  type StudyPreferences,
} from "@/features/settings/preferences";
import { createDocumentContext, STUDYBUD_SYSTEM_PROMPT } from "@/lib/ai/studybud-prompt";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
}

interface GeminiContent {
  role: "user" | "model";
  parts: Array<
    | { text: string }
    | { inlineData: { mimeType: "application/pdf"; data: string } }
  >;
}

export interface GeminiGenerationConfig {
  temperature?: number;
  responseMimeType?: "application/json";
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export async function generateWithGemini(
  systemInstruction: string,
  contents: GeminiContent[],
  generationConfig: GeminiGenerationConfig = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError("Google AI is not configured. Add GEMINI_API_KEY to .env.local.", 503);
  }

  let response: Response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
          generationConfig,
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
  } catch (error) {
    console.error("Google AI request failed before receiving a response:", error);
    throw new AIProviderError(
      "StudyBud could not reach the AI service. Check your connection and try again.",
      502,
    );
  }

  let result: GeminiGenerateContentResponse;
  try {
    result = (await response.json()) as GeminiGenerateContentResponse;
  } catch (error) {
    console.error("Google AI returned an unreadable response:", error);
    throw new AIProviderError("The AI service returned an invalid response. Please try again.", 502);
  }

  if (!response.ok) {
    console.error("Google AI request was rejected:", {
      status: response.status,
      providerStatus: result.error?.status,
      providerCode: result.error?.code,
    });

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new AIProviderError(
        "The Google AI request was rejected. Check GEMINI_API_KEY and its API access.",
        503,
      );
    }
    if (response.status === 429) {
      throw new AIProviderError(
        "The AI service is busy or its usage limit was reached. Please try again later.",
        503,
      );
    }
    throw new AIProviderError(
      "The AI service could not answer this question right now. Please try again.",
      502,
    );
  }

  const answer = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!answer) {
    throw new AIProviderError("StudyBud received an empty answer. Please try asking again.", 502);
  }

  return answer;
}

export async function answerFromDocument(
  extractedText: string,
  history: ChatMessage[],
  question: string,
  preferences: StudyPreferences = DEFAULT_PREFERENCES,
): Promise<string> {
  const difficulty = {
    simple: "Use plain language and define technical terms.",
    standard: "Use clear explanations appropriate for a student.",
    advanced: "Use precise terminology and explain the reasoning in depth.",
  }[preferences.difficulty];
  const length = {
    concise: "Keep the answer brief and focused.",
    balanced: "Give a balanced explanation with enough context to understand.",
    detailed: "Give a thorough explanation with useful detail.",
  }[preferences.answerLength];
  const style = {
    examples: "Include a relevant example when it helps understanding.",
    "step-by-step": "Break processes and reasoning into clear steps when useful.",
    analogies: "Use an analogy when it helps make an idea easier to understand.",
  }[preferences.learningStyle];

  return generateWithGemini(
    `${STUDYBUD_SYSTEM_PROMPT}\n\nStudent explanation preferences: ${difficulty} ${length} ${style}`,
    [
      {
        role: "user",
        parts: [{ text: createDocumentContext(extractedText) }],
      },
      ...history.map((message) => ({
        role: message.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: message.content }],
      })),
      {
        role: "user",
        parts: [{ text: question }],
      },
    ],
    { temperature: 0.2 },
  );
}
