"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import type { DailyChallengeOverview } from "@/lib/civilization/daily-challenge";

type Props = { initial: DailyChallengeOverview };

export function DailyChallengeClient({ initial }: Props) {
  const [overview, setOverview] = useState(initial);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.attempt?.selectedIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { challenge, attempt } = overview;
  const selected = challenge.choices.filter((choice) => selectedIds.includes(choice.id));
  const totalCost = selected.reduce((sum, choice) => sum + choice.cost, 0);
  const totalImpact = selected.reduce((sum, choice) => sum + choice.impact, 0);
  const underBudget = totalCost <= challenge.budget;

  function toggleChoice(id: string) {
    if (attempt || saving) return;
    setError(null);
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length >= challenge.maxSelections ? current : [...current, id]);
  }

  async function submit() {
    if (saving || attempt || !selectedIds.length || !underBudget) return;
    setSaving(true);
    setError(null);
    const response = await apiFetch<DailyChallengeOverview>("/api/civilization/challenge", {
      method: "POST",
      body: JSON.stringify({ selectedIds }),
    });
    setSaving(false);
    if (response.error || !response.data) {
      setError(response.error?.message ?? "Could not save your result.");
      return;
    }
    setOverview(response.data);
    setSelectedIds(response.data.attempt?.selectedIds ?? []);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7" aria-labelledby="challenge-title">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          {challenge.dayKey} · Daily planning puzzle (UTC)
        </p>
        <h2 id="challenge-title" className="mt-3 font-display text-2xl font-semibold text-foreground">
          {challenge.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-secondary">{challenge.story}</p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="rounded-xl border border-border bg-background px-3 py-2 font-semibold text-foreground">
            Budget: {challenge.budget} fictional tokens
          </span>
          <span className="rounded-xl border border-border bg-background px-3 py-2 font-semibold text-foreground">
            Up to {challenge.maxSelections} choices
          </span>
          <span className="rounded-xl border border-border bg-background px-3 py-2 font-semibold text-foreground">
            One entry per UTC day
          </span>
        </div>
        <p className="mt-4 rounded-xl bg-background p-3 text-xs leading-6 text-secondary">{challenge.notice}</p>
      </section>

      <section aria-label="Choose improvements" className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <fieldset disabled={Boolean(attempt) || saving}>
          <legend className="text-lg font-semibold text-foreground">
            Choose your improvements
          </legend>
          <p className="mt-2 text-sm text-secondary">
            Each improvement has a fictional token cost and game impact. A small bonus rewards varied categories.
            Find the best combination before submitting: you cannot change today's final choice.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {challenge.choices.map((choice) => {
              const checked = selectedIds.includes(choice.id);
              return (
                <label key={choice.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 hover:border-accent">
                  <input type="checkbox" name="improvement" value={choice.id} checked={checked}
                    disabled={!checked && selectedIds.length >= challenge.maxSelections}
                    onChange={() => toggleChoice(choice.id)}
                    className="mt-1 size-4 shrink-0 accent-cyan-600" />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{choice.title}</span>
                    <span className="mt-1 block text-xs font-semibold text-accent">{choice.category}</span>
                    <span className="mt-2 block text-sm leading-6 text-secondary">{choice.description}</span>
                    <span className="mt-3 block text-xs font-semibold text-foreground">
                      Cost: {choice.cost} · Impact: {choice.impact}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 rounded-xl border border-border bg-background p-4" aria-live="polite">
          <p className="text-sm font-semibold text-foreground">
            {selectedIds.length} of {challenge.maxSelections} choices · {totalCost}/{challenge.budget} tokens
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full bg-accent transition-all"
              style={{ width: String(Math.min(100, (totalCost / challenge.budget) * 100)) + "%" }} />
          </div>
          <p className="mt-2 text-sm text-secondary">
            Base impact: {totalImpact}. Final score is calculated and saved by the server.
          </p>
          {!underBudget && <p className="mt-2 text-sm font-semibold text-rose-600" role="alert">
            Over budget. Remove an improvement before submitting.
          </p>}
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 p-3 text-sm text-rose-600">
          {error}
        </p>}
        {attempt ? (
          <div className="mt-5 rounded-xl border border-border bg-background p-5" role="status">
            <p className="text-sm font-semibold text-accent">Challenge completed</p>
            <p className="mt-2 font-display text-3xl font-bold text-foreground">{attempt.score}/100</p>
            <p className="mt-2 text-sm text-secondary">
              Your result is saved for {challenge.dayKey}. Return after the next UTC day begins to play again.
              No Vascoin or official district funding was issued.
            </p>
          </div>
        ) : (
          <button type="button" onClick={submit}
            disabled={saving || !selectedIds.length || !underBudget}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Checking and saving…" : "Submit final plan"}
          </button>
        )}
      </section>

      <section aria-label="Anonymous daily leaderboard"
        className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-foreground">Today's anonymous scores</h2>
        <p className="mt-2 text-sm text-secondary">
          {overview.participantCount} completed entries today. Scores never reveal usernames or identities.
        </p>
        {overview.myRank && <p className="mt-3 text-sm font-semibold text-accent">
          Your rank by score: {overview.myRank}
        </p>}
        {overview.topScores.length ? (
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {overview.topScores.map((score, index) => (
              <li key={index} className="flex justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <span className="text-secondary">Entry {index + 1}</span>
                <span className="font-semibold text-foreground">{score}/100</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-4 text-sm text-secondary">No completed challenges yet today.</p>}
      </section>
    </div>
  );
}
