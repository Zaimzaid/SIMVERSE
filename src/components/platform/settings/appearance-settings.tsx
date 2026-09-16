"use client";

import { Check, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const OPTIONS: { value: Theme; label: string; icon: typeof Moon }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
];

/** Theme preference selector. Persists via the ThemeProvider (localStorage). */
export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how SIMVERSE looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid max-w-md grid-cols-2 gap-3"
        >
          {OPTIONS.map((option) => {
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                  selected
                    ? "border-accent/60 bg-accent-soft"
                    : "border-border-strong bg-background/40 hover:border-accent/40 hover:bg-surface-hover",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-lg border border-border",
                    selected ? "text-accent" : "text-secondary",
                  )}
                >
                  <option.icon className="size-5" />
                </span>
                <span className="flex-1 font-medium text-foreground">
                  {option.label}
                </span>
                {selected ? <Check className="size-4 text-accent" /> : null}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
