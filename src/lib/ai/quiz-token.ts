import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { QuizAnswer } from "@/features/study/quiz-types";

const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

interface QuizTokenPayload {
  documentId: string;
  expiresAt: number;
  questions: QuizAnswer[];
}

function getEncryptionKey(): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY is required to secure generated quiz answers.");
  }

  return createHash("sha256").update(`studybud-quiz-answer-key:${secret}`).digest();
}

export function createQuizToken(documentId: string, questions: QuizAnswer[]): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const payload: QuizTokenPayload = {
    documentId,
    expiresAt: Date.now() + TOKEN_LIFETIME_MS,
    questions,
  };
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function readQuizToken(token: string, documentId: string): QuizAnswer[] {
  if (token.length > 20_000) {
    throw new Error("Invalid quiz token.");
  }

  const [ivPart, tagPart, encryptedPart, extraPart] = token.split(".");
  if (!ivPart || !tagPart || !encryptedPart || extraPart) {
    throw new Error("Invalid quiz token.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const payload = JSON.parse(decrypted) as QuizTokenPayload;

  if (
    payload.documentId !== documentId ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt < Date.now() ||
    !Array.isArray(payload.questions) ||
    payload.questions.length !== 5
  ) {
    throw new Error("Quiz expired or does not belong to this document.");
  }

  return payload.questions;
}
