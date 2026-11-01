"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type Civic = {
  primaryNationality: { countryId: string; countryName: string; issuedAt: Date | string } | null;
  residence: { districtId: string; districtName: string; since: Date | string; nextTransferAvailableAt: Date | string } | null;
  visit: { countryId: string; countryName: string; expiresAt: Date | string } | null;
  ballotDistrictId: string | null;
  eligibleToVote: boolean;
  votingNotice: string;
  policies: { transferCooldownDays: number; ballotResidenceTenureDays: number; visitDurationDays: number };
};
type District = { id: string; name: string; available: number; capacity: number };
type PublishedCountry = { id: string; name: string };

export function FoundingCivicDashboard({ initial, districts, publicCountries }: {
  initial: Civic;
  districts: District[];
  publicCountries: PublishedCountry[];
}) {
  const router = useRouter();
  const [districtId, setDistrictId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function post(path: string, method: "POST" | "DELETE", body?: object) {
    setBusy(true);
    setFeedback(null);
    const result = await apiFetch(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    setBusy(false);
    if (result.error) {
      setFeedback(result.error.message);
      return;
    }
    setFeedback("Change saved. Your identity and voting eligibility are determined by approved records.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-secondary">Primary citizenship</p>
          <p className="mt-1 font-semibold text-foreground">{initial.primaryNationality?.countryName ?? "Not issued"}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-secondary">Current home district</p>
          <p className="mt-1 font-semibold text-foreground">{initial.residence?.districtName ?? "Unassigned"}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-secondary">District voting</p>
          <p className="mt-1 font-semibold text-foreground">{initial.eligibleToVote ? "Eligible" : "Not eligible"}</p>
        </div>
      </div>
      <p className="text-sm leading-7 text-secondary">{initial.votingNotice}</p>
      <div className="rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground">Join or transfer to an active district</h3>
        <p className="mt-2 text-sm text-secondary">
          You must have active citizenship in the same country. Only districts with
          independently verified geography, active status and available capacity can appear.
          Transfers require {initial.policies.transferCooldownDays} days between changes.
        </p>
        {districts.length ? <div className="mt-4 flex flex-wrap gap-2">
          <label htmlFor="district-selection" className="sr-only">Select active district</label>
          <select id="district-selection" value={districtId} onChange={(e) => setDistrictId(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
            <option value="">Select an active district</option>
            {districts.map((d) => <option key={d.id} value={d.id} disabled={d.available === 0}>
              {d.name} · {d.available} places remaining
            </option>)}
          </select>
          <button disabled={busy || !districtId} type="button"
            onClick={() => post("/api/civilization/residence", "POST", { districtId })}
            className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">
            {initial.residence ? "Transfer district" : "Join district"}
          </button>
        </div> : <p className="mt-3 text-sm text-amber-700 dark:text-amber-200">
          No eligible active districts are available. This remains closed until geographic approval.
        </p>}
      </div>
      <div className="rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground">Travel is not residence</h3>
        <p className="mt-2 text-sm text-secondary">
          Optional in-world visits last {initial.policies.visitDurationDays} days and never change
          your citizenship, home district or ballot rights.
        </p>
        {initial.visit && <p className="mt-2 text-sm text-foreground">
          Visiting {initial.visit.countryName} until {new Date(initial.visit.expiresAt).toLocaleDateString()}
        </p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <label htmlFor="visit-country" className="sr-only">Published country to visit</label>
          <select id="visit-country" value={countryId} onChange={(e) => setCountryId(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
            <option value="">Choose published destination</option>
            {publicCountries.map((country) => <option value={country.id} key={country.id}>{country.name}</option>)}
          </select>
          <button type="button" disabled={busy || !countryId}
            onClick={() => post("/api/civilization/visit", "POST", { countryId })}
            className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">
            Start visit
          </button>
          {initial.visit && <button type="button" disabled={busy}
            onClick={() => post("/api/civilization/visit", "DELETE")}
            className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">
            End visit
          </button>}
        </div>
      </div>
      {feedback && <p role="status" className="rounded-xl border border-border p-4 text-sm text-foreground">{feedback}</p>}
    </div>
  );
}
