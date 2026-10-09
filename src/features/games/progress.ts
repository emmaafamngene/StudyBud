export const ARENA_PROGRESS_STORAGE_KEY = "studybud.arena-progress";

interface ArenaProgress {
  xp: number;
  awardedSessions: string[];
}

function readProgress(): ArenaProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ARENA_PROGRESS_STORAGE_KEY) ?? "{}");
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { xp: 0, awardedSessions: [] };
    }

    const progress = value as Record<string, unknown>;
    return {
      xp:
        typeof progress.xp === "number" && Number.isSafeInteger(progress.xp) && progress.xp >= 0
          ? progress.xp
          : 0,
      awardedSessions: Array.isArray(progress.awardedSessions)
        ? progress.awardedSessions.filter((session): session is string => typeof session === "string")
        : [],
    };
  } catch (error) {
    console.error("Unable to read StudyBud Arena progress:", error);
    return { xp: 0, awardedSessions: [] };
  }
}

export function readArenaXp(): number {
  return readProgress().xp;
}

export function awardArenaXp(sessionId: string, xp: number): number {
  if (!Number.isSafeInteger(xp) || xp < 0) {
    throw new Error("The game returned an invalid XP award.");
  }

  const progress = readProgress();
  if (progress.awardedSessions.includes(sessionId)) return progress.xp;

  const next: ArenaProgress = {
    xp: progress.xp + xp,
    awardedSessions: [sessionId, ...progress.awardedSessions].slice(0, 500),
  };
  localStorage.setItem(ARENA_PROGRESS_STORAGE_KEY, JSON.stringify(next));
  return next.xp;
}
