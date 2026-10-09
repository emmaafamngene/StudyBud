import Link from "next/link";

interface AppHeaderProps {
  active: "home" | "library" | "study" | "games" | "settings";
}

export default function AppHeader({ active }: AppHeaderProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-8"
      >
        <Link href="/" className="group inline-flex shrink-0 items-center gap-3 lg:hidden" aria-label="StudyBud home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-sm shadow-indigo-200 transition group-hover:bg-indigo-700">
            S
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Study<span className="text-indigo-600">Bud</span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {active === "study" ? (
            <Link href="/documents" className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-3">
              My Documents
            </Link>
          ) : (
            <>
              {active === "home" ? (
                <span aria-current="page" className="inline-flex min-h-9 items-center rounded-lg bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 sm:px-3">
                  Home
                </span>
              ) : (
                <Link href="/" className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-3">
                  Home
                </Link>
              )}
              {active === "library" ? (
                <span aria-current="page" className="inline-flex min-h-9 items-center rounded-lg bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 sm:px-3">
                  My Documents
                </span>
              ) : (
                <Link href="/documents" className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-3">
                  My Documents
                </Link>
              )}
              {active === "games" ? (
                <span aria-current="page" className="inline-flex min-h-9 items-center rounded-lg bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 sm:px-3">
                  Games
                </span>
              ) : (
                <Link href="/games" className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-3">
                  Games
                </Link>
              )}
              <Link
                href="/settings"
                aria-current={active === "settings" ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold sm:px-3 ${
                  active === "settings"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Settings
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
