import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { shareImagePath } from "@/lib/media/share/constants";
import type { PublicMediaShareV1 } from "@/lib/media/share/schemas";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";

const RATIO_FRAME: Record<string, string> = {
  LANDSCAPE_16_9: "aspect-video",
  PORTRAIT_9_16: "aspect-[9/16] max-w-[360px]",
  SQUARE_1_1: "aspect-square max-w-xl",
};

/**
 * Standalone public presentation of a shared SIMVERSE result. Every creator- and
 * Run-derived string is rendered as React text (auto-escaped) — never HTML. The
 * hero reuses the public render endpoint (preview === export). No platform shell.
 */
export function PublicShareView({ share, publicId }: { share: PublicMediaShareV1; publicId: string }) {
  const { artifact, result, participants, scenes } = share;
  const heroSrc = `${shareImagePath(publicId)}?type=result-card&format=svg&ratio=${artifact.aspectRatio}`;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="aurora" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-5">
          <Link href="/" className="font-display text-lg font-extrabold tracking-[0.12em] text-foreground">SIMVERSE</Link>
          <Link href="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Create your own<ArrowRight className="size-4" />
          </Link>
        </header>

        <main className="flex-1 pb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {artifact.moduleLabel} · <span className="capitalize text-secondary">{artifact.mode}</span>
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-5xl">{artifact.title}</h1>
          {artifact.subtitle ? <p className="mt-3 max-w-2xl text-base text-secondary sm:text-lg">{artifact.subtitle}</p> : null}

          <div className={cn("mx-auto mt-8 w-full overflow-hidden rounded-2xl border border-border-strong shadow-2xl", RATIO_FRAME[artifact.aspectRatio] ?? "aspect-video")}>
            {/* Loads the public render endpoint (same design as any export). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroSrc} alt={result.headline} className="size-full object-contain" />
          </div>

          <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-8">
              <div className="rounded-2xl border border-success/30 bg-success-soft p-6">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                  <Trophy className="size-4 text-warning" aria-hidden />Final result
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">{result.headline}</h2>
                <p className="mt-3 text-sm text-secondary sm:text-base">{result.detail}</p>
              </div>

              {scenes.length ? (
                <div>
                  <h3 className="font-display text-lg font-semibold">How it unfolded</h3>
                  <ol className="mt-4 space-y-4">
                    {scenes.map((scene, index) => (
                      <li key={`${scene.kind}-${index}`} className="flex gap-4 rounded-xl border border-border bg-surface/60 p-4">
                        <span className="mt-0.5 shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{scene.kind.replaceAll("_", " ")}</p>
                          <p className="mt-0.5 font-medium text-foreground">{scene.title}</p>
                          {scene.caption ? <p className="mt-1 text-sm text-secondary">{scene.caption}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {artifact.description ? (
                <p className="text-sm text-secondary">{artifact.description}</p>
              ) : null}
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-border bg-surface/60 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Final ranking</h3>
                <ol className="mt-3 space-y-2">
                  {result.ranking.map((entry) => (
                    <li key={`${entry.rank}-${entry.name}`} className="flex items-center gap-3 text-sm">
                      <span className="w-6 shrink-0 text-right font-mono text-muted">{entry.rank}</span>
                      <span className="min-w-0 truncate font-medium text-foreground">{entry.name}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Competitors</h3>
                <ul className="mt-3 space-y-2.5">
                  {participants.map((participant) => (
                    <li key={participant.name} className="flex items-center gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{ color: participant.color, backgroundColor: `${participant.color}22`, border: `1.5px solid ${participant.color}` }}
                      >
                        {participant.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{participant.name}</p>
                        <p className="truncate text-xs capitalize text-muted">{participant.category}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </section>
        </main>

        <footer className="border-t border-border py-8 text-center">
          <p className="text-sm text-secondary">Created in <span className="font-semibold text-foreground">SIMVERSE</span></p>
          <Link href="/" className="mt-3 inline-flex text-sm text-accent hover:underline">Build and share your own simulation →</Link>
        </footer>
      </div>
    </div>
  );
}
