"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BrainCircuit, Check, ChevronRight, CircleAlert, CircleCheck,
  Eye, RotateCcw, Shield, Sparkles, Target, Trophy, X,
} from "lucide-react";
import { AFTERCHOICE_SCENARIOS } from "@/lib/afterchoice/scenarios";
import {
  TRACKS, checkPlan, resolveMatch,
  type MatchResult, type Scenario, type TrackValues,
} from "@/lib/afterchoice/engine";

type Phase = "plan" | "guard" | "result";
const SAVE_KEY = "kavandro.afterchoice.best-scores.v1";

function TrackBoard({
  scenario, values, reference,
}: {
  scenario: Scenario; values: TrackValues; reference?: TrackValues;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Crisis status">
      {TRACKS.map((key) => {
        const value = values[key];
        const target = scenario.targets[key];
        const met = value >= target;
        const change = reference ? value - reference[key] : 0;
        return (
          <div key={key} className="rounded-2xl border border-border bg-background/75 p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-secondary">{scenario.trackLabels[key]}</p>
              {met ? <Check className="size-4 shrink-0 text-success" aria-label="Target reached" />
                : <CircleAlert className="size-4 shrink-0 text-warning" aria-label="Below target" />}
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-3xl font-bold tabular-nums text-foreground">{value}</span>
              <span className="text-xs text-muted">/ {target} needed</span>
              {reference && change !== 0 && (
                <span className={`text-xs font-bold tabular-nums ${change > 0 ? "text-success" : "text-danger"}`}>
                  {change > 0 ? "+" : ""}{change}
                </span>
              )}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
              <div className={`h-full rounded-full transition-all duration-300 ${met ? "bg-success" : "bg-accent"}`}
                style={{ width: `${Math.min(100, Math.max(0, value / Math.max(1, target)) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChangeText({ scenario, changes }: { scenario: Scenario; changes: Partial<TrackValues> }) {
  const entries = TRACKS.filter((key) => (changes[key] ?? 0) !== 0);
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((key) => {
        const value = changes[key] ?? 0;
        return (
          <span key={key} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${value > 0
            ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
            {scenario.trackLabels[key]} {value > 0 ? "+" : ""}{value}
          </span>
        );
      })}
    </div>
  );
}

export function AfterchoiceGame() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("plan");
  const [chosen, setChosen] = useState<string[]>([]);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const scenario = AFTERCHOICE_SCENARIOS[scenarioIndex]!;
  const check = useMemo(() => checkPlan(scenario, chosen), [scenario, chosen]);
  const preview = check.values;
  const countMet = TRACKS.filter((key) => preview[key] >= scenario.targets[key]).length;
  const selectedGuard = scenario.safeguards.find((item) => item.id === guardId);
  const displayedValues = result?.final ?? preview;
  const completedCount = Object.keys(bestScores).filter((key) => bestScores[key] > 0).length;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const valid = Object.fromEntries(Object.entries(parsed).filter(
            ([key, value]) => AFTERCHOICE_SCENARIOS.some((item) => item.id === key)
              && typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100,
          ));
          setBestScores(valid as Record<string, number>);
        }
      }
    } catch { /* Browser storage is optional. */ }
  }, []);

  function reset(nextIndex: number = scenarioIndex) {
    setScenarioIndex(nextIndex);
    setPhase("plan");
    setChosen([]);
    setGuardId(null);
    setResult(null);
  }

  function toggleAction(id: string, cost: number) {
    if (phase !== "plan") return;
    if (chosen.includes(id)) {
      setChosen((old) => old.filter((item) => item !== id));
    } else if (chosen.length < scenario.actionLimit && check.creditsUsed + cost <= scenario.credits) {
      setChosen((old) => [...old, id]);
    }
  }

  function finish() {
    if (!guardId || !check.valid || phase !== "guard") return;
    const outcome = resolveMatch(scenario, chosen, guardId);
    setResult(outcome);
    setPhase("result");
    const next = { ...bestScores, [scenario.id]: Math.max(bestScores[scenario.id] ?? 0, outcome.score) };
    setBestScores(next);
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(next)); }
    catch { /* A private browser can disable storage. Gameplay still works. */ }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-14 -top-28 size-80 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-36 left-1/4 size-72 rounded-full bg-purple/10 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            <BrainCircuit className="size-4" aria-hidden /> KAVANDRO ORIGINALS · SOLO PROTOTYPE
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            AFTER<span className="text-gradient">CHOICE</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-secondary">
            Anyone can make a decision. Can you survive its consequences?
            Build a plan, predict the challenger, and protect what matters.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-secondary">
            <span className="inline-flex items-center gap-1.5"><Shield className="size-4 text-accent" /> Deterministic opponent</span>
            <span className="inline-flex items-center gap-1.5"><Trophy className="size-4 text-accent" /> {completedCount}/{AFTERCHOICE_SCENARIOS.length} scenarios attempted</span>
            <span className="inline-flex items-center gap-1.5"><Eye className="size-4 text-accent" /> No 3D required</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Select crisis scenario">
        {AFTERCHOICE_SCENARIOS.map((item, index) => (
          <button key={item.id} type="button" onClick={() => reset(index)}
            aria-pressed={scenarioIndex === index}
            className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent ${scenarioIndex === index
              ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover"}`}>
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wider text-muted">
              <span>{item.chapter}</span>
              {bestScores[item.id] !== undefined && <span className="text-accent">Best: {bestScores[item.id]}</span>}
            </div>
            <p className="mt-2 font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-xs text-secondary">{index === 0 ? "Starter" : index === 1 ? "Intermediate" : "Advanced"}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Game stages">
              {(["plan", "guard", "result"] as const).map((step, index) => {
                const active = phase === step;
                const completed = ["plan", "guard", "result"].indexOf(phase) > index;
                return (
                  <div key={step} className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${active
                    ? "bg-accent-soft text-accent" : completed ? "bg-success-soft text-success" : "bg-background text-muted"}`}>
                    <span>{completed ? "✓" : index + 1}</span>
                    <span>{step === "plan" ? "Architect" : step === "guard" ? "Predict" : "Consequences"}</span>
                    {index < 2 && <ChevronRight className="size-3" aria-hidden />}
                  </div>
                );
              })}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{scenario.chapter}</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">{scenario.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">{scenario.premise}</p>
            <p className="mt-3 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-medium text-foreground">
              <Target className="mr-2 inline size-4 align-[-3px] text-accent" aria-hidden />
              {scenario.objective}
            </p>

            <div className="mb-3 mt-7 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {phase === "result" ? "Final city status" : "Projected system status"}
              </h3>
              <span className={`text-xs font-semibold ${countMet === 4 && phase !== "result" ? "text-success" : "text-secondary"}`}>
                {phase === "result" && result
                  ? `${result.passed.length}/4 systems holding`
                  : `${countMet}/4 targets in your plan`}
              </span>
            </div>
            <TrackBoard scenario={scenario} values={displayedValues} reference={scenario.initial} />
          </section>

          {phase === "plan" && (
            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">01 / THINK</p>
                  <h2 className="mt-2 font-display text-xl font-semibold">Build your strategy</h2>
                  <p className="mt-2 text-sm text-secondary">Select interventions. Each creates benefits and trade-offs.</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-4 py-2 text-right">
                  <p className="text-xs text-muted">Credits used</p>
                  <p className="font-display text-xl font-semibold tabular-nums">{check.creditsUsed} <span className="text-xs text-muted">/ {scenario.credits}</span></p>
                  <p className="text-[11px] text-secondary">{chosen.length}/{scenario.actionLimit} actions</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {scenario.actions.map((action) => {
                  const checked = chosen.includes(action.id);
                  const disabled = !checked && (chosen.length >= scenario.actionLimit
                    || check.creditsUsed + action.cost > scenario.credits);
                  return (
                    <button key={action.id} type="button" onClick={() => toggleAction(action.id, action.cost)}
                      disabled={disabled} aria-pressed={checked}
                      className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${checked
                        ? "border-accent bg-accent-soft" : "border-border bg-background/45 hover:border-accent/45 hover:bg-surface-hover"}`}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex size-6 items-center justify-center rounded-md border ${checked ? "border-accent bg-accent text-accent-foreground" : "border-border-strong"}`}>
                            {checked && <Check className="size-4" aria-hidden />}
                          </span>
                          <span className="font-semibold text-foreground">{action.title}</span>
                        </div>
                        <span className="whitespace-nowrap rounded-full bg-surface-elevated px-2 py-1 text-xs font-bold text-foreground">{action.cost} cr</span>
                      </div>
                      <p className="mb-3 text-xs leading-5 text-secondary">{action.description}</p>
                      <ChangeText scenario={scenario} changes={action.change} />
                      <p className="mt-3 text-[11px] italic leading-5 text-muted">{action.consequence}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <p className="max-w-md text-xs text-secondary">
                  {!chosen.length ? "Choose your first intervention." : countMet < 4
                    ? "Some targets remain below the threshold. You can still test this plan."
                    : "Every target is currently met—but the challenger has not attacked yet."}
                </p>
                <button type="button" onClick={() => setPhase("guard")} disabled={!check.valid}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40">
                  Lock strategy <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            </section>
          )}

          {phase === "guard" && (
            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">02 / ANTICIPATE</p>
              <h2 className="mt-2 font-display text-xl font-semibold">The challenger is coming</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                The challenger targets the disruption that would cause the largest shortfall in your plan.
                You do not get to see the chosen attack until you commit. Protect against one threat.
              </p>
              <h3 className="mt-6 text-sm font-semibold text-foreground">Threat intelligence</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {scenario.threats.map((threat) => (
                  <div key={threat.id} className="rounded-xl border border-border bg-background/50 p-3">
                    <p className="text-sm font-semibold text-foreground">{threat.title}</p>
                    <p className="mt-2 text-xs leading-5 text-secondary">{threat.signal}</p>
                    <div className="mt-3"><ChangeText scenario={scenario} changes={threat.change} /></div>
                  </div>
                ))}
              </div>
              <h3 className="mt-7 text-sm font-semibold text-foreground">Choose exactly one safeguard</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {scenario.safeguards.map((guard) => (
                  <button key={guard.id} type="button" aria-pressed={guardId === guard.id}
                    onClick={() => setGuardId(guard.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${guardId === guard.id
                      ? "border-accent bg-accent-soft" : "border-border bg-background/50 hover:border-accent/50"}`}>
                    <Shield className={`size-5 ${guardId === guard.id ? "text-accent" : "text-secondary"}`} aria-hidden />
                    <p className="mt-3 font-semibold text-foreground">{guard.title}</p>
                    <p className="mt-2 text-xs leading-5 text-secondary">{guard.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-border pt-5">
                <button type="button" onClick={() => setPhase("plan")}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-secondary hover:bg-surface-hover">
                  Revise plan
                </button>
                <button type="button" disabled={!selectedGuard} onClick={finish}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40">
                  Resolve consequences <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            </section>
          )}

          {phase === "result" && result && (
            <section className="overflow-hidden rounded-3xl border border-border bg-surface p-5 sm:p-7" aria-live="polite">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">03 / VERDICT</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold">
                    {result.won ? "Your strategy survived." : "The challenger found a weakness."}
                  </h2>
                  <p className="mt-2 text-sm text-secondary">
                    {result.won ? "All four essential systems remain above their targets." : `${result.failed.length} critical system(s) remain below the target after the disruption.`}
                  </p>
                </div>
                <div className="rounded-2xl border border-accent/30 bg-accent-soft px-5 py-3 text-right">
                  <p className="text-xs font-semibold text-accent">FINAL SCORE</p>
                  <p className="font-display text-4xl font-bold tabular-nums text-foreground">{result.score}<span className="text-sm text-muted">/100</span></p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Challenger's move</p>
                  <p className="mt-2 font-semibold text-foreground">{result.attack.title}</p>
                  <p className="mt-2 text-xs leading-5 text-secondary">{result.attack.cascade}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Your safeguard</p>
                  <p className="mt-2 font-semibold text-foreground">{result.safeguard.title}</p>
                  <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${result.blocked ? "text-success" : "text-danger"}`}>
                    {result.blocked ? <CircleCheck className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                    {result.blocked ? "Prediction correct · disruption countered" : "Prediction missed · safeguard ineffective"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Your efficiency</p>
                  <p className="mt-2 font-semibold text-foreground">{scenario.credits - result.creditsUsed} credits unspent</p>
                  <p className="mt-2 text-xs leading-5 text-secondary">Unused resources and resilience can increase your score.</p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-background/55 p-4">
                <h3 className="text-sm font-semibold text-foreground">Consequence timeline</h3>
                <ol className="mt-4 space-y-3 text-sm text-secondary">
                  <li><span className="mr-2 font-bold text-accent">1.</span>Your interventions set the initial crisis response.</li>
                  <li><span className="mr-2 font-bold text-accent">2.</span>{result.attack.cascade}</li>
                  <li><span className="mr-2 font-bold text-accent">3.</span>{result.blocked
                    ? "Your anticipated safeguard restored the threatened resource."
                    : "Your safeguard prepared for a different threat and had no effect."}</li>
                  <li><span className="mr-2 font-bold text-accent">4.</span>
                    {result.won ? "Every essential system remained stable." :
                      `Unresolved: ${result.failed.map((key) => scenario.trackLabels[key]).join(", ")}.`}
                  </li>
                </ol>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => reset()}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                  <RotateCcw className="size-4" aria-hidden /> Try another strategy
                </button>
                {scenarioIndex < AFTERCHOICE_SCENARIOS.length - 1 && (
                  <button type="button" onClick={() => reset(scenarioIndex + 1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-5 py-3 text-sm font-semibold text-foreground hover:bg-surface-hover">
                    Next crisis <ArrowRight className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-accent">
              <Target className="size-5" aria-hidden />
              <h2 className="font-display text-lg font-semibold text-foreground">Mission control</h2>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-secondary">Credits</dt><dd className="font-semibold tabular-nums text-foreground">{scenario.credits}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-secondary">Max actions</dt><dd className="font-semibold tabular-nums text-foreground">{scenario.actionLimit}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-secondary">Possible threats</dt><dd className="font-semibold tabular-nums text-foreground">{scenario.threats.length}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-secondary">Safeguards</dt><dd className="font-semibold tabular-nums text-foreground">Choose 1</dd></div>
            </dl>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-accent"><Sparkles className="size-5" aria-hidden />
              <h2 className="font-display text-lg font-semibold text-foreground">How to win</h2></div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-secondary">
              <li><span className="font-bold text-foreground">1.</span> Choose actions without exceeding the budget.</li>
              <li><span className="font-bold text-foreground">2.</span> Reason about the consequences across all four systems.</li>
              <li><span className="font-bold text-foreground">3.</span> Predict which disruption hurts your plan most.</li>
              <li><span className="font-bold text-foreground">4.</span> Protect the right system and keep all targets above the threshold.</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-4 text-xs leading-6 text-secondary">
            <p className="flex items-center gap-2 font-semibold text-foreground"><BrainCircuit className="size-4 text-accent" aria-hidden /> Practice prototype</p>
            <p className="mt-2">The challenger follows public deterministic rules. Scores are saved in this browser only—not synchronized across devices. This is not live multiplayer or a currency-earning game.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
