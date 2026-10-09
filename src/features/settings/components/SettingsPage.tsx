"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/ui/AppHeader";
import AppSidebar from "@/components/ui/AppSidebar";
import {
  applyAppearance,
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  readStudyPreferences,
  type StudyPreferences,
} from "@/features/settings/preferences";

const selectStyle =
  "mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<StudyPreferences>(DEFAULT_PREFERENCES);
  const [isReady, setIsReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setPreferences(readStudyPreferences());
    setIsReady(true);
  }, []);

  function savePreferences(next: StudyPreferences) {
    setPreferences(next);
    setSaveError(null);
    setIsSaved(false);
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      applyAppearance(next.appearance);
      setIsSaved(true);
    } catch (error) {
      console.error("Unable to save StudyBud preferences:", error);
      setSaveError("Your browser could not save this preference. Check its site storage settings.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6fc]">
      <AppSidebar active="settings" />
      <div className="min-h-screen lg:pl-[220px]">
        <AppHeader active="settings" />
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        <header className="mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
            Make StudyBud yours
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Settings</h1>
          <p className="mt-2 text-sm text-slate-500">
            Choose how StudyBud looks and how it explains your study material.
          </p>
        </header>

        {saveError && (
          <p role="alert" className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {saveError}
          </p>
        )}

        <section aria-labelledby="appearance-heading" className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700" aria-hidden="true">◐</span>
            <div>
              <h2 id="appearance-heading" className="text-sm font-bold text-slate-900">Appearance</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Choose a theme for your workspace.</p>
            </div>
          </div>
          <label className="mt-4 block max-w-sm text-xs font-semibold text-slate-700">
            Color theme
            <select
              disabled={!isReady}
              value={preferences.appearance}
              onChange={(event) =>
                savePreferences({
                  ...preferences,
                  appearance: event.target.value as StudyPreferences["appearance"],
                })
              }
              className={selectStyle}
            >
              <option value="system">System default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </section>

        <section aria-labelledby="study-preferences-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700" aria-hidden="true">✦</span>
            <div>
              <h2 id="study-preferences-heading" className="text-sm font-bold text-slate-900">Study preferences</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                These choices shape future AI tutor answers. Existing messages are unchanged.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">
              Explanation difficulty
              <select
                disabled={!isReady}
                value={preferences.difficulty}
                onChange={(event) =>
                  savePreferences({
                    ...preferences,
                    difficulty: event.target.value as StudyPreferences["difficulty"],
                  })
                }
                className={selectStyle}
              >
                <option value="simple">Simple</option>
                <option value="standard">Standard</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Answer length
              <select
                disabled={!isReady}
                value={preferences.answerLength}
                onChange={(event) =>
                  savePreferences({
                    ...preferences,
                    answerLength: event.target.value as StudyPreferences["answerLength"],
                  })
                }
                className={selectStyle}
              >
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Learning style
              <select
                disabled={!isReady}
                value={preferences.learningStyle}
                onChange={(event) =>
                  savePreferences({
                    ...preferences,
                    learningStyle: event.target.value as StudyPreferences["learningStyle"],
                  })
                }
                className={selectStyle}
              >
                <option value="examples">Use examples</option>
                <option value="step-by-step">Step by step</option>
                <option value="analogies">Use analogies</option>
              </select>
            </label>
          </div>
          {isSaved && (
            <p role="status" className="mt-4 text-[11px] text-emerald-700">
              Preferences saved on this device.
            </p>
          )}
        </section>

        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          StudyBud does not have accounts or sign-in yet, so account, password, and sync settings are not shown.
        </p>
        </main>
      </div>
    </div>
  );
}
