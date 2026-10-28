"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe2, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import type { DualCitizenshipAssessment } from "@/lib/player-identity/governance";

type Country = { id: string; name: string; isoAlpha2: string | null };
interface Preview { country: Country; assessment: DualCitizenshipAssessment; notice: string }

export function DualCitizenshipPreview({ countries }: { countries: Country[] }) {
  const { toast } = useToast();
  const [countryPlaceId, setCountryPlaceId] = useState(countries[0]?.id ?? "");
  const [result, setResult] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  async function check() {
    setLoading(true); setResult(null);
    const { data, error } = await apiFetch<Preview>("/api/player-governance/citizenship-preview", {
      method: "POST", body: JSON.stringify({ countryPlaceId }),
    });
    setLoading(false);
    if (error) {
      toast({ variant: "error", title: "Cannot check citizenship requirements", description: error.message });
    } else setResult(data ?? null);
  }
  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-label="Virtual second citizenship eligibility">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Globe2 className="size-5 text-accent" aria-hidden /> Citizenship & Dual-Citizenship Qualifications
      </h2>
      <p className="mt-2 text-sm text-secondary">
        Review your fictional citizenship pathway before applying. A second virtual citizenship requires both countries' active policies,
        an approved destination residency record and the required residence period. No policy means no dual-citizenship approval.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-xs font-semibold text-secondary" htmlFor="citizenship-preview-country">
          Virtual country
          <select id="citizenship-preview-country" value={countryPlaceId}
            onChange={(event) => { setCountryPlaceId(event.target.value); setResult(null); }}
            className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            disabled={!countries.length}>
            {countries.length ? countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)
              : <option value="">No supported country available</option>}
          </select>
        </label>
        <button type="button" onClick={() => void check()} disabled={loading || !countryPlaceId}
          className="self-end rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
          {loading ? "Checking…" : "Check qualifications"}
        </button>
      </div>
      {result ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-4" aria-live="polite">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-accent" aria-hidden /> {result.country.name} — {result.assessment.eligible ? "Eligible to apply" : "Not yet eligible"}
          </h3>
          {result.assessment.checks.map((check) => <p key={check.code} className="mt-2 text-sm text-secondary">
            <span aria-label={check.met ? "Passed" : "Not met"}>{check.met ? "✓" : "○"}</span> {check.label}
          </p>)}
          <p className="mt-3 text-xs text-muted">{result.notice}</p>
          {result.assessment.eligible ? <Link href="/profile/documents" className="mt-3 inline-block text-sm text-accent hover:underline">
            Start or review your SIMVERSE citizenship application →
          </Link> : null}
        </div>
      ) : null}
    </section>
  );
}
