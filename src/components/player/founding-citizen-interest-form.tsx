"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { FOUNDING_NATION_NAMES } from "@/lib/civilization/phase3-contract";

type Props = {
  initial: {
    preferredNationSlug: string | null;
    proposedPilotInterest: boolean;
  };
};

export function FoundingCitizenInterestForm({ initial }: Props) {
  const router = useRouter();
  const [preferredNationSlug, setPreferredNationSlug] = useState(initial.preferredNationSlug ?? "");
  const [proposedPilotInterest, setProposedPilotInterest] = useState(initial.proposedPilotInterest);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSaving(true);
    const response = await apiFetch<{
      preferredNationSlug: string | null;
      proposedPilotInterest: boolean;
    }>("/api/civilization/my-interest", {
      method: "PATCH",
      body: JSON.stringify({
        preferredNationSlug: preferredNationSlug || null,
        proposedPilotInterest,
      }),
    });
    setSaving(false);
    if (response.error || !response.data) {
      setFeedback({ success: false, message: response.error?.message ?? "Could not save your preference." });
      return;
    }
    setFeedback({
      success: true,
      message: "Preference saved. No citizenship, residence, district membership or voting rights have been granted.",
    });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6" aria-label="Founding nation interest">
      <div>
        <label htmlFor="founding-country" className="mb-2 block text-sm font-semibold text-foreground">
          Preferred founding nationality — for future consideration
        </label>
        <p className="mb-3 text-xs leading-relaxed text-secondary">
          This is a changeable preference, not a virtual citizenship application or an approved national status.
          No fictional countries have been published by this feature.
        </p>
        <select id="founding-country" value={preferredNationSlug}
          onChange={(event) => { setPreferredNationSlug(event.target.value); setFeedback(null); }}
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground focus:border-accent focus:outline-none">
          <option value="">No preference selected</option>
          {FOUNDING_NATION_NAMES.map((country) =>
            <option key={country.slug} value={country.slug}>{country.name}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-4">
        <label htmlFor="pilot-interest" className="flex cursor-pointer items-start gap-3">
          <input id="pilot-interest" type="checkbox" checked={proposedPilotInterest}
            onChange={(event) => { setProposedPilotInterest(event.target.checked); setFeedback(null); }}
            className="mt-1 size-4 shrink-0 accent-cyan-600"/>
          <span className="space-y-1">
            <span className="block text-sm font-semibold text-foreground">I'm interested in the proposed founding district</span>
            <span className="block text-xs leading-relaxed text-secondary">
              The possible first pilot is in Arandia. You can express interest regardless
              of your preferred nationality. This is a non-binding signal, not a waitlist
              reservation, active residence, district assignment or access pass.
            </span>
          </span>
        </label>
      </div>

      {feedback && (
        <p role="status" className={`rounded-xl border px-3 py-3 text-sm ${feedback.success
          ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
          : "border-rose-500/30 text-rose-700 dark:text-rose-300"}`}>
          {feedback.message}
        </p>
      )}
      <button type="submit" disabled={saving}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">
        {saving ? "Saving preference…" : "Save my preference"}
      </button>
    </form>
  );
}
