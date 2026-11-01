"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { FOUNDING_NATION_NAMES } from "@/lib/civilization/phase3-contract";

type Draft = { targetNationSlug: string; motivation: string; updatedAt: Date | string } | null;

export function FoundingCitizenshipDraftForm({ initial, suggestedCountry }: {
  initial: Draft;
  suggestedCountry: string | null;
}) {
  const router = useRouter();
  const [nation, setNation] = useState(initial?.targetNationSlug ?? suggestedCountry ?? "");
  const [motivation, setMotivation] = useState(initial?.motivation ?? "");
  const [saved, setSaved] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await apiFetch("/api/civilization/my-application-draft", {
      method: "PATCH",
      body: JSON.stringify({ targetNationSlug: nation, motivation }),
    });
    setBusy(false);
    if (result.error) {
      setError(true);
      setMessage(result.error.message);
      return;
    }
    setError(false);
    setSaved(true);
    setMessage("Private draft saved. It was not submitted for citizenship review.");
    router.refresh();
  }

  async function clear() {
    setBusy(true);
    setMessage(null);
    const result = await apiFetch("/api/civilization/my-application-draft", { method: "DELETE" });
    setBusy(false);
    if (result.error) {
      setError(true);
      setMessage(result.error.message);
      return;
    }
    setSaved(false);
    setNation(suggestedCountry ?? "");
    setMotivation("");
    setError(false);
    setMessage("Private draft deleted. Your nationality preference was not changed.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4" aria-label="Prepare a future citizenship application">
      <p className="text-sm leading-6 text-secondary">
        Prepare your request privately. The official application queue, country reviewer grants
        and citizenship approvals are not available for the new founding nations yet.
      </p>
      <div>
        <label htmlFor="application-nation" className="mb-2 block text-sm font-semibold text-foreground">
          Country you may apply to
        </label>
        <select id="application-nation" value={nation}
          onChange={(event) => { setNation(event.target.value); setMessage(null); }}
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground">
          <option value="">Choose a founding country</option>
          {FOUNDING_NATION_NAMES.map((country) => (
            <option value={country.slug} key={country.slug}>{country.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="citizenship-motivation" className="mb-2 block text-sm font-semibold text-foreground">
          Why would you like to become a citizen? <span className="font-normal text-secondary">(optional)</span>
        </label>
        <textarea id="citizenship-motivation" value={motivation}
          onChange={(event) => { setMotivation(event.target.value); setMessage(null); }}
          maxLength={750} rows={3}
          placeholder="Tell us what interests you about this country's future..."
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground"
        />
        <p className="mt-1 text-sm text-secondary">{motivation.length}/750 characters. Do not enter passwords, government ID numbers or sensitive personal details.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || !nation}
          className="min-h-11 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60">
          {busy ? "Saving…" : saved ? "Update private draft" : "Save private draft"}
        </button>
        {saved && <button type="button" disabled={busy} onClick={clear}
          className="min-h-11 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground disabled:opacity-60">
          Delete draft
        </button>}
      </div>
      {message && <p role="status" className={`rounded-xl border p-3 text-sm ${error ? "border-rose-500/30 text-rose-700 dark:text-rose-300" : "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"}`}>{message}</p>}
      <p className="text-sm text-secondary">
        Status: <strong>Draft only</strong> · No submission, review, approval, citizenship
        document, district residence or voting rights.
      </p>
    </form>
  );
}
