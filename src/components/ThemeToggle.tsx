"use client";

// Global light/dark switch. Dark is the default; choosing light adds a `light`
// class to <html> (which remaps the slate ramp in globals.css) and is persisted
// to localStorage. An inline script in the root layout applies the stored
// choice before paint to avoid a flash.
//
// Both icons are always rendered; the `light:` variant decides which one shows,
// so no React state is needed and there's no SSR/hydration mismatch.
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle("light");
  try {
    localStorage.setItem("theme", isLight ? "light" : "dark");
  } catch {
    /* ignore unavailable storage (private mode, etc.) */
  }
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
      className="fixed right-3 top-3 z-20 rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-slate-300 backdrop-blur transition hover:bg-slate-800 hover:text-slate-100 light:bg-slate-900"
    >
      <MoonIcon className="h-5 w-5 light:hidden" />
      <SunIcon className="hidden h-5 w-5 light:block" />
    </button>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}
