"use client";

import { useEffect } from "react";
import { applyAppearance, readStudyPreferences } from "@/features/settings/preferences";

export default function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const preferences = readStudyPreferences();
      applyAppearance(preferences.appearance);
    };
    media.addEventListener("change", syncTheme);
    window.addEventListener("storage", syncTheme);
    syncTheme();
    return () => {
      media.removeEventListener("change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return null;
}
