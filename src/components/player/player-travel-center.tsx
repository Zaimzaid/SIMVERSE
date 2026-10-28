"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, FileCheck2, ShieldAlert, TicketCheck } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import type { TravelVerdict } from "@/lib/player-identity/travel";

type Country = { id: string; name: string; isoAlpha2: string | null };
type Visa = {
  id: string; status: string; displayStatus: string; serial: string | null;
  purpose: string; submittedAt: string | Date;
  expiresAt: string | Date | null; reviewNote: string | null;
  originCountry: Country; destinationCountry: Country;
};
interface TravelInfo {
  countries: Country[];
  visas: Visa[];
  notice: string;
}
interface TravelResult {
  origin: Country; destination: Country;
  verdict: TravelVerdict;
  route: { mode: string | null; passportKind: string; description: string } | null;
}
const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground";
export function PlayerTravelCenter({ initial }: { initial: TravelInfo }) {
  const { toast } = useToast();
  const router = useRouter();
  const [originCountryId, setOrigin] = useState(initial.countries[0]?.id ?? "");
  const [destinationCountryId, setDestination] = useState(initial.countries[0]?.id ?? "");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [visas, setVisas] = useState(initial.visas);
  const [evaluated, setEvaluated] = useState<TravelResult | null>(null);
  const current = evaluated?.origin.id === originCountryId
    && evaluated.destination.id === destinationCountryId ? evaluated : null;
  const canApply = current?.route?.mode === "VISA_REQUIRED"
    && current.verdict.checks.filter((c) => c.code !== "visa").every((c) => c.met)
    && !visas.some((v) => v.originCountry.id === originCountryId
      && v.destinationCountry.id === destinationCountryId);
  function setRoute(type: "origin" | "destination", value: string) {
    if (type === "origin") setOrigin(value); else setDestination(value);
    setEvaluated(null);
  }
  async function check() {
    setBusy(true);
    const { data, error } = await apiFetch<TravelResult>("/api/player-travel/eligibility", {
      method: "POST", body: JSON.stringify({ originCountryId, destinationCountryId }),
    });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: "Unable to evaluate route", description: error.message });
    } else setEvaluated(data ?? null);
  }
  async function apply() {
    setBusy(true);
    const { data, error } = await apiFetch<{ visa: Visa }>("/api/player-travel/visas", {
      method: "POST", body: JSON.stringify({ originCountryId, destinationCountryId, purpose }),
    });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: "Entry visa not submitted", description: error.message });
      return;
    }
    if (data?.visa) {
      setVisas((items) => [data.visa, ...items]);
      setPurpose("");
      toast({ variant: "success", title: "Virtual visa application submitted", description: "A country reviewer must decide this application." });
      router.refresh();
    }
  }

  return <div className="space-y-6">
    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-secondary">
      <p className="flex items-start gap-2 font-semibold text-amber-200">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />{initial.notice}
      </p>
      <p className="mt-2 text-xs">No border crossing, in-world teleportation or legal visa is issued here.
        Unconfigured country-to-country routes are closed by default.</p>
    </div>
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Compass className="size-5 text-accent"/>Check my virtual travel eligibility</h2>
      <p className="mt-1 text-sm text-secondary">Select countries. SIMVERSE checks approved citizenship, unexpired virtual passports, residency and destination route rules.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label className="mb-1 block text-xs font-semibold text-secondary" htmlFor="travel-origin">Virtual travel origin</label>
          <select className={inputClass} id="travel-origin" value={originCountryId}
            onChange={(e) => setRoute("origin", e.target.value)} disabled={!initial.countries.length}>
            {initial.countries.length ? initial.countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
              : <option value="">No sourced countries available</option>}
          </select>
        </div>
        <div><label className="mb-1 block text-xs font-semibold text-secondary" htmlFor="travel-destination">Virtual destination</label>
          <select className={inputClass} id="travel-destination" value={destinationCountryId}
            onChange={(e) => setRoute("destination", e.target.value)} disabled={!initial.countries.length}>
            {initial.countries.length ? initial.countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
              : <option value="">No sourced countries available</option>}
          </select>
        </div>
      </div>
      <button type="button" onClick={() => void check()} disabled={busy || !originCountryId || !destinationCountryId}
        className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
        {busy ? "Checking…" : "Check travel requirements"}
      </button>

      {current ? <div aria-live="polite" className="mt-5 rounded-xl border border-border bg-background p-4">
        <h3 className="font-semibold">Route: {current.origin.name} → {current.destination.name}</h3>
        <p className="mt-1 text-sm text-secondary">Result: <strong>{current.verdict.status.replaceAll("_", " ")}</strong></p>
        {current.route ? <p className="mt-1 text-xs text-muted">
          Pilot rule: {current.route.mode?.replaceAll("_", " ")} · {current.route.passportKind.replaceAll("_", " ")}
        </p> : null}
        {current.verdict.checks.map((check) => <p className="mt-2 text-sm text-secondary" key={check.code}>
          <span aria-label={check.met ? "Satisfied" : "Missing"}>{check.met ? "✓" : "○"}</span> {check.label}
        </p>)}
        {canApply ? <div className="mt-4 space-y-2 border-t border-border pt-4">
          <label htmlFor="visa-purpose" className="block text-xs font-semibold text-secondary">Reason for fictional travel (optional)</label>
          <textarea id="visa-purpose" maxLength={500} rows={3} value={purpose}
            onChange={(e) => setPurpose(e.target.value)} className={inputClass}/>
          <button type="button" disabled={busy} onClick={() => void apply()}
            className="rounded-lg border border-accent/50 bg-accent-soft px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50">
            Apply for a SIMVERSE virtual entry visa
          </button>
        </div> : null}
        {current.verdict.status === "UNAVAILABLE" ? <p className="mt-3 text-xs text-warning">
          A SIMVERSE operator must configure and activate this fictional country route first. The player cannot activate routes.
        </p> : null}
      </div> : null}
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><TicketCheck className="size-5 text-accent"/>My SIMVERSE entry visa applications</h2>
      {!visas.length ? <p className="mt-3 text-sm text-secondary">No virtual entry visa applications have been submitted.</p> :
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{visas.map((visa) => <article key={visa.id} className="rounded-xl border border-border bg-background p-4">
          <h3 className="font-semibold">{visa.originCountry.name} → {visa.destinationCountry.name}</h3>
          <p className="mt-1 text-sm text-secondary">Status: <strong>{visa.displayStatus.replaceAll("_", " ")}</strong></p>
          {visa.serial ? <p className="mt-2 break-all font-mono text-xs text-accent">{visa.serial}</p> : null}
          {visa.expiresAt ? <p className="mt-1 text-xs text-muted">Pilot expiry: {new Date(visa.expiresAt).toLocaleDateString()}</p> : null}
          {visa.reviewNote ? <p className="mt-2 text-xs text-secondary">Review: {visa.reviewNote}</p> : null}
        </article>)}</div>}
      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <FileCheck2 className="size-4 shrink-0"/>Even an approved virtual entry visa is insufficient if the route is closed, citizenship changes, or a required passport expires.
      </p>
    </section>
    <Link href="/profile/documents" className="inline-block text-sm font-semibold text-accent hover:underline">← Return to my virtual passports and citizenship</Link>
  </div>;
}
