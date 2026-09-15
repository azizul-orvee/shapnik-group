"use client";

import Link from "next/link";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleTheme } from "./theme-toggle";

export function UserMenu({
  name,
  signInId,
  roleLabel,
  signOutAction,
}: {
  name: string;
  signInId: string;
  roleLabel: string;
  signOutAction: () => Promise<void>;
}) {
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full md:size-8"
          aria-label="Account menu"
        >
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-xs font-semibold">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{name}</div>
          <div className="text-muted-foreground truncate font-mono text-xs font-normal">
            {signInId}
          </div>
          <div className="text-muted-foreground mt-1 text-xs font-normal">{roleLabel}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserRound className="size-4" />
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer md:hidden"
          onSelect={(event) => {
            event.preventDefault();
            toggleTheme();
          }}
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
          <span className="dark:hidden">Switch to dark mode</span>
          <span className="hidden dark:inline">Switch to light mode</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => {
            void signOutAction();
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
