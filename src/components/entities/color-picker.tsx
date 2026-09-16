"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";

export interface ColorPickerProps {
  label: string;
  /** "" (no color) or a 6-digit hex like #22D3EE */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  id?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_SWATCH = "#22D3EE";

/**
 * Accessible color control: a native color input paired with a synced hex text
 * field. Empty is allowed (no color chosen). The stored value is uppercase hex.
 */
export function ColorPicker({ label, value, onChange, hint, id }: ColorPickerProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const colorId = `${inputId}-swatch`;

  // The native picker requires a valid hex; show a default when the field is empty.
  const swatch = HEX.test(value) ? value : DEFAULT_SWATCH;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-center gap-2.5">
        <span
          className="relative inline-flex size-10 shrink-0 overflow-hidden rounded-lg border border-border-strong"
          style={{ backgroundColor: HEX.test(value) ? value : undefined }}
        >
          {!value ? (
            <span className="absolute inset-0 grid place-items-center text-xs text-muted" aria-hidden="true">
              —
            </span>
          ) : null}
          <input
            id={colorId}
            type="color"
            value={swatch}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
          />
        </span>
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="#22D3EE"
          className="font-mono uppercase"
          spellCheck={false}
          maxLength={7}
          aria-label={`${label} hex value`}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
