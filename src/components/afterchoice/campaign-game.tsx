"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BrainCircuit, Check, ChevronRight, CircleAlert,
  Clock3, RotateCcw, Shield, Sparkles, Target, Trophy, Waves,
} from "lucide-react";
import {
  TIDAL_CAMPAIGN, campaignVerdict, planCampaignRound, playCampaignRound,
  startCampaign, type CampaignPlan, type CampaignState,
} from "@/lib/afterchoice/campaign";
import { TRACKS, type Change, type TrackValues } from "@/lib/afterchoice/engine";

type Phase = "plan" | "defend" | "aftermath";

function Effects({ changes }: { changes: Change }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TRACKS.filter((track) => (changes[track] ?? 0) !== 0).map((track) => {
        const value = changes[track] ?? 0;
        return (
          <span key={track} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${value >= 0
            ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
            {TIDAL_CAMPAIGN.trackLabels[track]} {value > 0 ? "+" : ""}{value}
          </span>
        );
      })}
    </div>
  );
}

function Resources({ values, initial }: { values: TrackValues; initial: TrackValues }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TRACKS.map((track) => {
        const target = TIDAL_CAMPAIGN.targets[track];
        const met = values[track] >= target;
        const difference = values[track] - initial[track];
        return (
          <div key={track} className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-secondary">{TIDAL_CAMPAIGN.trackLabels[track]}</p>
              {met
                ? <Check aria-label="Target met" className="size-4 text-success" />
                : <CircleAlert aria-label="Below target" className="size-4 text-warning" />}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="font-display text-3xl font-bold tabular-nums">{values[track]}</span>
              <span className="text-xs text-muted">/ {target}</span>
              {difference !== 0 && (
                <span className={`text-xs font-bold tabular-nums ${difference > 0 ? "text-success" : "text-danger"}`}>
                  {difference > 0 ? "+" : ""}{difference}
                </span>
              )}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
              <div className={`h-full rounded-full transition-all ${met ? "bg-success" : "bg-accent"}`}
                style={{ width: `${Math.min(100, Math.max(0, values[track] / Math.max(1, target) * 100))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Budget({ plan, selected }: { plan: CampaignPlan; selected: number }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3 text-right">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Nightly budget</p>
      <p className="font-display text-xl font-semibold tabular-nums">{plan.creditsUsed}
        <span className="text-xs text-muted"> / {TIDAL_CAMPAIGN.credits} credits</span>
      </p>
      <p className="text-xs text-muted">{selected} / {TIDAL_CAMPAIGN.actionLimit} interventions</p>
    </div>
  );
}

export function AfterchoiceCampaignGame() {
  const [state, setState] = useState<CampaignState>(() => startCampaign(TIDAL_CAMPAIGN));
  const [phase, setPhase] = useState<Phase>("plan");
  const [chosen, setChosen] = useState<string[]>([]);
  const [safeguardId, setSafeguardId] = useState<string | null>(null);
  const scenario = TIDAL_CAMPAIGN;
  const plan = useMemo(() => planCampaignRound(scenario, state, chosen), [scenario, state, chosen]);
  const latest = state.history[state.history.length - 1];
  const verdict = campaignVerdict(scenario, state);
  const values = phase === "aftermath" && latest ? latest.final : plan.planned;
  const met = TRACKS.filter((key) => values[key] >= scenario.targets[key]).length;

  function reset() {
    setState(startCampaign(scenario));
    setChosen([]);
    setSafeguardId(null);
    setPhase("plan");
  }

  function toggle(id: string, cost: number) {
    if (phase !== "plan") return;
    if (chosen.includes(id)) {
      setChosen((selected) => selected.filter((item) => item !== id));
    } else if (chosen.length < scenario.actionLimit && plan.creditsUsed + cost <= scenario.credits) {
      setChosen((selected) => [...selected, id]);
    }
  }

  function resolve() {
    if (phase !== "defend" || !safeguardId || !plan.valid) return;
    setState((previous) => playCampaignRound(scenario, previous, chosen, safeguardId));
    setPhase("aftermath");
  }

  function nextNight() {
    if (phase !== "aftermath" || state.complete) return;
    setChosen([]);
    setSafeguardId(null);
    setPhase("plan");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-blue/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute bottom-0 left-16 size-64 rounded-full bg-purple/10 blur-3xl" aria-hidden />
        <div className="relative">
          <Link href="/games/afterchoice"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-accent">
            <ArrowLeft className="size-4" aria-hidden /> AFTERCHOICE solo trials
          </Link>
          <span className="flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-accent">
            <BrainCircuit className="size-4" aria-hidden /> AFTERCHOICE · Campaign mode
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {scenario.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">{scenario.premise}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {Array.from({ length: scenario.rounds }, (_, index) => {
              const played = state.history[index];
              const active = !state.complete && index + 1 === state.round;
              return (
                <div key={index} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${played
                  ? "border-success/40 bg-success-soft text-success" : active
                    ? "border-accent/50 bg-accent-soft text-accent" : "border-border bg-background text-muted"}`}>
                  {played ? <Check className="size-3.5" aria-hidden /> : <Clock3 className="size-3.5" aria-hidden />}
                  Night {index + 1} {played ? `· ${played.score} pts` : active ? "· Live" : "· Future"}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                  {state.complete ? "Campaign complete" : `Night ${state.round} / ${scenario.rounds}`}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
                  {phase === "aftermath" ? "Outcome after the attack" : "Projected resources after your plan"}
                </h2>
              </div>
              <span className="text-xs font-semibold text-secondary">{met}/4 targets met</span>
            </div>
            <Resources values={values} initial={phase === "aftermath" && latest ? latest.starting : state.values} />
            {phase !== "aftermath" && plan.activated.length > 0 && (
              <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                  <Clock3 className="size-4" aria-hidden /> Effects arriving this night
                </p>
                <ul className="mt-2 space-y-1 text-xs leading-6 text-secondary">
                  {plan.activated.map((effect, index) => <li key={index}>• {effect.description}</li>)}
                </ul>
              </div>
            )}
          </section>

          {phase === "plan" && (
            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">01 · Architect</p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-foreground">Choose this night's decisions</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
                    Every intervention changes resources now. Some effects arrive tomorrow, and your current
                    weaknesses attract the challenger's attack.
                  </p>
                </div>
                <Budget plan={plan} selected={chosen.length} />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {scenario.actions.map((action) => {
                  const selected = chosen.includes(action.id);
                  const disabled = !selected && (chosen.length >= scenario.actionLimit
                    || plan.creditsUsed + action.cost > scenario.credits);
                  return (
                    <button key={action.id} type="button" aria-pressed={selected} disabled={disabled}
                      onClick={() => toggle(action.id, action.cost)}
                      className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${selected
                        ? "border-accent bg-accent-soft" : "border-border bg-background/60 hover:border-accent/40"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex items-center gap-2 font-semibold text-foreground">
                          <span className={`inline-flex size-5 items-center justify-center rounded border ${selected ? "border-accent bg-accent text-accent-foreground" : "border-border-strong"}`}>
                            {selected && <Check className="size-3.5" aria-hidden />}
                          </span>
                          {action.title}
                        </p>
                        <span className="whitespace-nowrap rounded-full bg-surface-elevated px-2 py-1 text-xs font-bold">{action.cost} cr</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-secondary">{action.description}</p>
                      <div className="mt-3"><Effects changes={action.change} /></div>
                      <p className="mt-3 text-[11px] italic leading-5 text-muted">{action.consequence}</p>
                      {action.delayed && (
                        <div className="mt-3 border-t border-border/80 pt-3">
                          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-accent">
                            <Clock3 className="size-3.5" aria-hidden /> Next-night consequence
                          </p>
                          <Effects changes={action.delayed.change} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {plan.queued.length > 0 && (
                <div className="mt-4 rounded-xl border border-border bg-background/60 p-4 text-xs text-secondary">
                  <p className="font-semibold text-foreground">Scheduled consequences</p>
                  <ul className="mt-2 space-y-1">
                    {plan.queued.map((effect, index) => (
                      <li key={index}>Night {effect.dueRound}: {effect.description}</li>
                    ))}
                  </ul>
                  {state.round === scenario.rounds && (
                    <p className="mt-2 text-warning">This is the final night: effects scheduled for Night {scenario.rounds + 1} do not activate within this campaign.</p>
                  )}
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <p className="text-xs text-secondary">
                  {met < 4 ? "Some resources are below target. Plan ahead for the disruption."
                    : "All targets are met for now. The challenger attacks next."}
                </p>
                <button type="button" disabled={!plan.valid} onClick={() => setPhase("defend")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40">
                  Lock interventions <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            </section>
          )}

          {phase === "defend" && (
            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">02 · Prediction</p>
              <h2 className="mt-2 font-display text-xl font-semibold">Anticipate the disruption</h2>
              <p className="mt-2 text-sm leading-7 text-secondary">
                The challenger compares the damage each threat would cause, including cascading failures.
                If two attacks are similarly dangerous, it adapts using past weaknesses and past attacks.
                It cannot see the safeguard you choose.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {scenario.threats.map((threat) => (
                  <div key={threat.id} className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="font-semibold text-foreground">{threat.title}</p>
                    <p className="mt-2 text-xs leading-5 text-secondary">{threat.signal}</p>
                    <div className="mt-3"><Effects changes={threat.change} /></div>
                    <p className="mt-3 text-[11px] leading-5 text-warning">
                      If {scenario.trackLabels[threat.cascade.track]} falls below {threat.cascade.below}: {threat.cascade.explanation}
                    </p>
                  </div>
                ))}
              </div>
              <h3 className="mt-6 text-sm font-semibold text-foreground">Protect one weak point</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {scenario.safeguards.map((safeguard) => (
                  <button key={safeguard.id} type="button" aria-pressed={safeguardId === safeguard.id}
                    onClick={() => setSafeguardId(safeguard.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${safeguardId === safeguard.id
                      ? "border-accent bg-accent-soft" : "border-border bg-background/60 hover:border-accent/40"}`}>
                    <Shield className="size-5 text-accent" aria-hidden />
                    <p className="mt-2 font-semibold text-foreground">{safeguard.title}</p>
                    <p className="mt-2 text-xs leading-5 text-secondary">{safeguard.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-border pt-5">
                <button type="button" onClick={() => setPhase("plan")}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-hover">
                  Revise interventions
                </button>
                <button type="button" disabled={!safeguardId} onClick={resolve}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40">
                  Reveal consequences <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            </section>
          )}

          {phase === "aftermath" && latest && (
            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                {state.complete ? "Final verdict" : `Night ${latest.round} · Aftermath`}
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-foreground">
                    {state.complete ? verdict.won ? "The city survives." : "The city remains vulnerable."
                      : latest.failed.length === 0 ? "All systems hold tonight." : "The city endured, but damage remains."}
                  </h2>
                  <p className="mt-2 text-sm text-secondary">
                    {latest.failed.length
                      ? `Below threshold: ${latest.failed.map((track) => scenario.trackLabels[track]).join(", ")}.`
                      : "All essential resources meet their targets."}
                  </p>
                </div>
                <div className="rounded-2xl border border-accent/30 bg-accent-soft px-5 py-3 text-right">
                  <p className="text-xs font-semibold text-accent">{state.complete ? "CAMPAIGN AVERAGE" : "NIGHT SCORE"}</p>
                  <p className="font-display text-3xl font-bold tabular-nums">
                    {state.complete ? verdict.averageScore : latest.score}<span className="text-sm text-muted">/100</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Attack</p>
                  <p className="mt-2 font-semibold text-foreground">{latest.attacker.title}</p>
                  <div className="mt-3"><Effects changes={latest.attacker.change} /></div>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Prediction</p>
                  <p className="mt-2 font-semibold text-foreground">
                    {latest.blocked ? "Correct prediction" : "Safeguard did not match"}
                  </p>
                  <p className={`mt-2 text-xs ${latest.blocked ? "text-success" : "text-warning"}`}>
                    {latest.blocked ? "The selected defence reduced the impact." : "The threat bypassed your prepared defence."}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Chain reaction</p>
                  <p className="mt-2 font-semibold text-foreground">
                    {latest.cascadeTriggered ? "Cascade triggered" : "Cascade avoided"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-secondary">
                    {latest.cascadeTriggered ? latest.attacker.cascade.explanation
                      : "The attacked resource stayed above the critical cascade threshold."}
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-sm font-semibold text-foreground">Night {latest.round} consequence log</p>
                <ol className="mt-3 space-y-2 text-xs leading-6 text-secondary">
                  <li>1. Starting conditions carried over from the previous night.</li>
                  <li>2. {latest.activated.length ? latest.activated.map((effect) => effect.description).join(" ") : "No delayed interventions arrived this night."}</li>
                  <li>3. Your {latest.actionIds.length} interventions changed city resources.</li>
                  <li>4. {latest.attacker.title} disrupted the plan. {latest.blocked ? "Your defence matched." : "Your defence did not match."}</li>
                  <li>5. {latest.cascadeTriggered ? latest.attacker.cascade.explanation : "No cascading failure occurred."}</li>
                </ol>
              </div>
              {state.complete && (
                <div className="mt-5 rounded-xl border border-accent/30 bg-accent-soft p-4">
                  <p className="flex items-center gap-2 font-semibold text-foreground">
                    <Trophy className="size-4 text-accent" aria-hidden /> Campaign results
                  </p>
                  <p className="mt-2 text-sm leading-6 text-secondary">
                    {verdict.stableNights}/{scenario.rounds} nights ended with every target met.
                    Your final-night stability determines victory; your average score reflects how well you
                    handled the entire crisis.
                  </p>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                {state.complete
                  ? <button type="button" onClick={reset}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                      <RotateCcw className="size-4" aria-hidden /> Replay campaign
                    </button>
                  : <button type="button" onClick={nextNight}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                      Continue to night {state.round} <ArrowRight className="size-4" aria-hidden />
                    </button>}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <Waves className="size-5 text-accent" aria-hidden />
              <h2 className="font-display text-lg font-semibold">Mission control</h2>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-secondary">Campaign</dt><dd className="font-semibold">3 nights</dd></div>
              <div className="flex justify-between"><dt className="text-secondary">Resources</dt><dd className="font-semibold">4 linked systems</dd></div>
              <div className="flex justify-between"><dt className="text-secondary">Credits per night</dt><dd className="font-semibold">{scenario.credits}</dd></div>
              <div className="flex justify-between"><dt className="text-secondary">Max decisions</dt><dd className="font-semibold">{scenario.actionLimit}</dd></div>
              <div className="flex justify-between"><dt className="text-secondary">Night average</dt><dd className="font-semibold tabular-nums">{verdict.averageScore}/100</dd></div>
            </dl>
          </section>
          <section className="rounded-3xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Target className="size-5 text-accent" aria-hidden /> Think two nights ahead
            </h2>
            <p className="mt-3 text-sm leading-6 text-secondary">
              You can repeat a decision in future nights, but consequences also repeat.
              Tomorrow's benefits and liabilities are visible before you commit.
            </p>
            <p className="mt-3 text-sm leading-6 text-secondary">
              A correct safeguard reduces the direct damage. It cannot erase a cascade
              if the resource still falls below its critical threshold.
            </p>
          </section>
          {state.history.length > 0 && (
            <section className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="font-display text-lg font-semibold">Previous nights</h2>
              <div className="mt-3 space-y-3">
                {state.history.map((record) => (
                  <div key={record.round} className="flex items-center justify-between gap-3 rounded-xl bg-background/60 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">Night {record.round}</p>
                      <p className="text-xs text-secondary">{record.failed.length} systems under target</p>
                    </div>
                    <span className="font-display font-semibold tabular-nums">{record.score}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <div className="rounded-2xl border border-border bg-background/70 p-4 text-xs leading-6 text-secondary">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <Sparkles className="size-4 text-accent" aria-hidden /> Phase 2 practice
            </p>
            <p className="mt-2">This is a local, unranked solo campaign. No actual multiplayer, prizes, or virtual currency. Progress resets if the page reloads.</p>
          </div>
        </aside>
      </div>
      <Link href="/games/afterchoice"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
        Return to solo trials <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
