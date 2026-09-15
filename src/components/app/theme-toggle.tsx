"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function toggleTheme() {
  const el = document.documentElement;
  const next = !el.classList.contains("dark");
  el.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    // Storage can be unavailable (private mode); the toggle still works for
    // this session.
  }
}

/**
 * Light/dark toggle. The class is applied to <html> before paint by the inline
 * script in the root layout, so the icon can key purely off the `dark` class via
 * CSS — no client state, no hydration mismatch, no flash.
 */
export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="text-muted-foreground hover:text-foreground hidden rounded-full md:inline-flex"
    >
      <Sun className="size-[1.15rem] dark:hidden" />
      <Moon className="hidden size-[1.15rem] dark:block" />
    </Button>
  );
}

/** Labeled row for the mobile More sheet and the account menu. */
export function ThemeToggleRow() {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex min-h-12 w-full items-center gap-3 px-3.5 py-3 text-left text-sm font-medium"
    >
      <Sun className="text-muted-foreground size-4.5 dark:hidden" />
      <Moon className="text-muted-foreground hidden size-4.5 dark:block" />
      <span className="dark:hidden">Switch to dark mode</span>
      <span className="hidden dark:inline">Switch to light mode</span>
    </button>
  );
}
