"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Globe, Link2, Lock, Share2 } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import {
  MEDIA_SHARE_VISIBILITIES,
  MEDIA_SHARE_VISIBILITY_HELP,
  MEDIA_SHARE_VISIBILITY_LABELS,
  isPubliclyVisible,
  sharePath,
  type MediaShareVisibility,
} from "@/lib/media/share/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface ShareState {
  exists: boolean;
  visibility: MediaShareVisibility;
  pinnedVersion: number | null;
  publicId: string | null;
  titleOverride: string | null;
}

interface SharePanelProps {
  artifactId: string;
  currentVersion: number;
  versions: number[];
  canShare: boolean;
  initialShare: ShareState;
}

const VIS_ICON = { PRIVATE: Lock, UNLISTED: Link2, PUBLIC: Globe } as const;

export function SharePanel({ artifactId, currentVersion, versions, canShare, initialShare }: SharePanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [share, setShare] = useState<ShareState>(initialShare);
  const [visibility, setVisibility] = useState<MediaShareVisibility>(initialShare.visibility);
  const [version, setVersion] = useState<number>(initialShare.pinnedVersion ?? currentVersion);
  const [titleOverride, setTitleOverride] = useState(initialShare.titleOverride ?? "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = share.publicId && typeof window !== "undefined" ? `${window.location.origin}${sharePath(share.publicId)}` : null;
  const liveLink = isPubliclyVisible(share.visibility) && shareUrl ? shareUrl : null;

  async function save() {
    if (!canShare || busy) return;
    setBusy(true);
    const result = await apiFetch<{ share: ShareState }>(`/api/media/artifacts/${artifactId}/share`, {
      method: "POST",
      body: JSON.stringify({ visibility, version, titleOverride }),
    });
    setBusy(false);
    if (result.error || !result.data) {
      toast({ variant: "error", title: "Sharing not updated", description: result.error?.message ?? "Please try again." });
      return;
    }
    const next = result.data.share;
    setShare(next);
    setVisibility(next.visibility);
    setVersion(next.pinnedVersion ?? currentVersion);
    toast({ variant: "success", title: "Sharing updated", description: `This storyboard is now ${MEDIA_SHARE_VISIBILITY_LABELS[next.visibility]}.` });
    router.refresh();
  }

  async function revoke() {
    if (!canShare || busy) return;
    setBusy(true);
    const result = await apiFetch<{ share: ShareState }>(`/api/media/artifacts/${artifactId}/share`, { method: "DELETE" });
    setBusy(false);
    if (result.error || !result.data) {
      toast({ variant: "error", title: "Could not revoke", description: result.error?.message ?? "Please try again." });
      return;
    }
    setShare(result.data.share);
    setVisibility("PRIVATE");
    toast({ variant: "success", title: "Sharing revoked", description: "The public link no longer works." });
    router.refresh();
  }

  async function copyLink() {
    if (!liveLink) return;
    try {
      await navigator.clipboard.writeText(liveLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ variant: "error", title: "Copy failed", description: "Select the link and copy it manually." });
    }
  }

  const dirty = visibility !== share.visibility || version !== (share.pinnedVersion ?? currentVersion) || (titleOverride || "") !== (share.titleOverride ?? "");

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Share2 className="size-4 text-accent" />Sharing</CardTitle>
        <p className="text-sm text-secondary">Decide who can see this storyboard. A share always points to one saved version.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {canShare ? (
          <>
            <div role="radiogroup" aria-label="Visibility" className="grid gap-2 sm:grid-cols-3">
              {MEDIA_SHARE_VISIBILITIES.map((option) => {
                const Icon = VIS_ICON[option];
                const active = option === visibility;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVisibility(option)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active ? "border-accent/60 bg-accent-soft text-foreground" : "border-border bg-background/40 text-secondary hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />{MEDIA_SHARE_VISIBILITY_LABELS[option]}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-secondary">{MEDIA_SHARE_VISIBILITY_HELP[visibility]}</p>

            {visibility !== "PRIVATE" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-medium text-secondary">Shared version
                  <Select value={String(version)} onChange={(event) => setVersion(Number(event.target.value))}>
                    {versions.map((candidate) => (
                      <option key={candidate} value={candidate}>Version {candidate}{candidate === currentVersion ? " · current" : ""}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1.5 text-xs font-medium text-secondary">Public title (optional)
                  <Input value={titleOverride} onChange={(event) => setTitleOverride(event.target.value)} maxLength={200} placeholder="Defaults to the storyboard title" />
                </label>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void save()} loading={busy} disabled={!dirty && share.visibility === visibility}>Update sharing</Button>
              {share.exists && share.visibility !== "PRIVATE" ? (
                <Button variant="secondary" onClick={() => void revoke()} loading={busy}>Revoke</Button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-secondary">This storyboard is <span className="font-medium text-foreground">{MEDIA_SHARE_VISIBILITY_LABELS[share.visibility]}</span>.</p>
        )}

        {liveLink ? (
          <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
            <p className="text-xs font-medium text-secondary">Share link</p>
            <div className="flex flex-wrap items-center gap-2">
              <input readOnly value={liveLink} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground" />
              <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}
              </Button>
              <a href={liveLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-secondary hover:text-foreground">
                <ExternalLink className="size-4" />Open
              </a>
            </div>
            {share.visibility === "UNLISTED" ? <p className="text-xs text-muted">Anyone with this link can view it.</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
