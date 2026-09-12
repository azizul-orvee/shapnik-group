"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Light/dark toggle. The class is applied to <html> before paint by the inline
 * script in the root layout, so the icon can key purely off the `dark` class via
 * CSS — no client state, no hydration mismatch, no flash.
 */
export function ThemeToggle() {
  function toggle() {
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

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="text-muted-foreground hover:text-foreground rounded-full"
    >
      <Sun className="size-[1.15rem] dark:hidden" />
      <Moon className="hidden size-[1.15rem] dark:block" />
    </Button>
  );
}
