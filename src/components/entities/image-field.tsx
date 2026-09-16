"use client";

import { useId, useRef, useState } from "react";
import { ImageOff, Link2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError, FieldHint } from "@/components/ui/field";

/** ~1MB raw file → ~1.34MB base64, under the 1.4M schema ceiling for inline images. */
const MAX_FILE_BYTES = 1_000_000;
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif";

export interface ImageFieldProps {
  label: string;
  /** An http(s) URL, a small inline data:image URL, or "". */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  id?: string;
}

/**
 * Image reference control. Accepts a pasted http(s) URL or a small uploaded
 * image inlined as a data URL (Phase 1 uses no paid cloud storage — larger media
 * should be referenced by URL). Shows a live preview and a clear action.
 */
export function ImageField({ label, value, onChange, hint, error, id }: ImageFieldProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const onFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError("Image is larger than 1MB. Upload a smaller file or paste a URL instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBroken(false);
        onChange(reader.result);
      }
    };
    reader.onerror = () => setFileError("Could not read that file. Try another image.");
    reader.readAsDataURL(file);
  };

  const clear = () => {
    setFileError(null);
    setBroken(false);
    onChange("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const showPreview = value.trim() !== "" && !broken;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-start gap-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-strong bg-background/60">
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="size-full object-cover"
              onError={() => setBroken(true)}
            />
          ) : (
            <ImageOff className="size-6 text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="relative">
            <Link2
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              id={inputId}
              type="url"
              inputMode="url"
              placeholder="https://…"
              className="pl-9"
              value={value.startsWith("data:") ? "" : value}
              onChange={(e) => {
                setBroken(false);
                setFileError(null);
                onChange(e.target.value);
              }}
              invalid={Boolean(error)}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              Upload
            </Button>
            {value ? (
              <button
                type="button"
                onClick={clear}
                className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
              >
                Remove
              </button>
            ) : null}
            {value.startsWith("data:") ? (
              <span className="text-xs text-muted">Uploaded image</span>
            ) : null}
          </div>
        </div>
      </div>
      {error || fileError ? (
        <FieldError id={`${inputId}-error`}>{error ?? fileError}</FieldError>
      ) : hint ? (
        <FieldHint>{hint}</FieldHint>
      ) : null}
    </div>
  );
}
