"use client";

import { useState } from "react";
import { Compass, MessageCircle, Sprout } from "lucide-react";

// This widget explains the planned experience. It is not simulated activity,
// and never implies that fictional national/district citizenship is available.
const moments = [
  {
    label: "Explore",
    icon: Compass,
    number: "01",
    title: "Discover a new world",
    detail: "Look around the fictional planet and imagine the places still to come.",
    stage: "Planet preview available",
  },
  {
    label: "Connect",
    icon: MessageCircle,
    number: "02",
    title: "Find your community",
    detail: "Meet people and, when districts open, join the conversations shaping them.",
    stage: "District communities in development",
  },
  {
    label: "Shape",
    icon: Sprout,
    number: "03",
    title: "Help it grow",
    detail: "Suggest ideas, discuss plans and help decide what your community should develop next.",
    stage: "Citizen-led development is planned",
  },
] as const;

export function CivilizationGlimpse() {
  const [active, setActive] = useState(0);
  const moment = moments[active] ?? moments[0];
  const Icon = moment.icon;

  return (
    <section aria-label="Discover the SIMVERSE idea"
      className="w-full rounded-3xl border border-border/80 bg-background/90 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">A glimpse of what is coming</p>
        <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-secondary">Early preview</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2" role="group" aria-label="Choose what to discover">
        {moments.map((item, index) => {
          const ButtonIcon = item.icon;
          return (
            <button key={item.label} type="button"
              onClick={() => setActive(index)}
              aria-pressed={active === index}
              className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active === index ? "border-accent/60 bg-accent-soft text-foreground" : "border-border bg-surface text-secondary hover:border-accent/40 hover:text-foreground"}`}>
              <ButtonIcon className="size-5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="mt-6 min-h-44 rounded-2xl border border-border bg-surface/70 p-5" aria-live="polite" aria-atomic="true">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Chapter {moment.number}</p>
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold text-foreground">{moment.title}</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">{moment.detail}</p>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-secondary">
        <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        {moment.stage}
      </p>
    </section>
  );
}
