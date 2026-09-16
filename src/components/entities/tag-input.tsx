"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Existing workspace tags offered as one-click chips. */
  suggestions?: string[];
  max?: number;
  id?: string;
}

/** Free-text tag entry: type then Enter or comma to add; suggestions are one click. */
export function TagInput({ value, onChange, suggestions = [], max = 30, id }: TagInputProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const label = raw.trim().replace(/,+$/, "").trim().slice(0, 40);
    if (!label) return;
    const exists = value.some((t) => t.toLowerCase() === label.toLowerCase());
    if (!exists && value.length < max) onChange([...value, label]);
    setDraft("");
  };

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeAt(value.length - 1);
    }
  };

  const atLimit = value.length >= max;
  const remaining = suggestions.filter(
    (s) => !value.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border-strong bg-background/60 p-2 transition-colors focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-ring/60">
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-1 text-xs text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove tag ${tag}`}
              className="text-muted transition-colors hover:text-danger"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={atLimit ? "Tag limit reached" : "Add a tag…"}
          disabled={atLimit}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {remaining.length > 0 && !atLimit ? (
        <div className="flex flex-wrap gap-1.5">
          {remaining.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-md border border-border px-2 py-0.5 text-xs text-secondary transition-colors hover:border-accent/40 hover:text-foreground"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
