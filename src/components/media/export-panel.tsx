"use client";

import { useState } from "react";
import { Download, LayoutTemplate, ScrollText } from "lucide-react";
import {
  MEDIA_ASPECT_RATIOS,
  MEDIA_ASPECT_RATIO_LABELS,
  type MediaAspectRatio,
} from "@/lib/media/constants";
import {
  MEDIA_EXPORT_FORMATS,
  MEDIA_EXPORT_FORMAT_LABELS,
  MEDIA_EXPORT_TYPES,
  MEDIA_EXPORT_TYPE_LABELS,
  type MediaExportFormat,
  type MediaExportType,
} from "@/lib/media/export/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface ExportPanelProps {
  artifactId: string;
  currentVersion: number;
  versions: number[];
  defaultAspectRatio: MediaAspectRatio;
}

const FRAME: Record<MediaAspectRatio, string> = {
  LANDSCAPE_16_9: "aspect-video",
  PORTRAIT_9_16: "aspect-[9/16] max-w-[260px]",
  SQUARE_1_1: "aspect-square max-w-sm",
};

const TYPE_ICON = { RESULT_CARD: LayoutTemplate, STORY_POSTER: ScrollText } as const;

function Segmented<T extends string>({ options, value, labels, onChange, idPrefix }: {
  options: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (next: T) => void;
  idPrefix: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={`${idPrefix}-label`} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-accent/60 bg-accent-soft text-foreground"
                : "border-border bg-background/40 text-secondary hover:border-border-strong hover:text-foreground",
            )}
          >
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

export function ExportPanel({ artifactId, currentVersion, versions, defaultAspectRatio }: ExportPanelProps) {
  const { toast } = useToast();
  const [exportType, setExportType] = useState<MediaExportType>("RESULT_CARD");
  const [ratio, setRatio] = useState<MediaAspectRatio>(defaultAspectRatio);
  const [format, setFormat] = useState<MediaExportFormat>("png");
  const [version, setVersion] = useState(currentVersion);
  const [busy, setBusy] = useState(false);

  const buildQuery = (fmt: MediaExportFormat) =>
    new URLSearchParams({ version: String(version), type: exportType, format: fmt, ratio }).toString();

  const previewUrl = `/api/media/artifacts/${artifactId}/export?${buildQuery("svg")}`;
  const TypeIcon = TYPE_ICON[exportType];

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/media/artifacts/${artifactId}/export?${buildQuery(format)}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast({ variant: "error", title: "Export failed", description: body?.error?.message ?? "Please try again." });
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1]
        ?? `simverse-${exportType.toLowerCase()}.${format}`;
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      toast({ variant: "success", title: "Export downloaded", description: filename });
    } catch {
      toast({ variant: "error", title: "Export failed", description: "Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Download className="size-4 text-accent" />Preview &amp; export</CardTitle>
        <p className="text-sm text-secondary">A shareable graphic rendered from this saved version. Save your edits first to include them.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={cn("mx-auto w-full overflow-hidden rounded-xl border border-border-strong bg-background", FRAME[ratio])}>
          {/* Loads the real export SVG from the authenticated endpoint, so preview === download. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={previewUrl} src={previewUrl} alt={`${MEDIA_EXPORT_TYPE_LABELS[exportType]} preview`} className="size-full object-contain" />
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p id="export-type-label" className="text-xs font-medium text-secondary">Graphic</p>
            <Segmented idPrefix="export-type" options={MEDIA_EXPORT_TYPES} value={exportType} labels={MEDIA_EXPORT_TYPE_LABELS} onChange={setExportType} />
          </div>
          <div className="space-y-1.5">
            <p id="export-format-label" className="text-xs font-medium text-secondary">File format</p>
            <Segmented idPrefix="export-format" options={MEDIA_EXPORT_FORMATS} value={format} labels={MEDIA_EXPORT_FORMAT_LABELS} onChange={setFormat} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <p id="export-ratio-label" className="text-xs font-medium text-secondary">Aspect ratio</p>
            <Segmented idPrefix="export-ratio" options={MEDIA_ASPECT_RATIOS} value={ratio} labels={MEDIA_ASPECT_RATIO_LABELS} onChange={setRatio} />
          </div>
          {versions.length > 1 ? (
            <label className="space-y-1.5 text-xs font-medium text-secondary sm:col-span-2">Version
              <Select value={String(version)} onChange={(event) => setVersion(Number(event.target.value))}>
                {versions.map((candidate) => (
                  <option key={candidate} value={candidate}>Version {candidate}{candidate === currentVersion ? " · current" : ""}</option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>

        <Button onClick={() => void download()} loading={busy} className="w-full">
          <TypeIcon className="size-4" />Download {MEDIA_EXPORT_TYPE_LABELS[exportType]} · {MEDIA_EXPORT_FORMAT_LABELS[format]}
        </Button>
      </CardContent>
    </Card>
  );
}
