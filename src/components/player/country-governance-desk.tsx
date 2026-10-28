"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client/api";

type Country = { id: string; name: string; isoAlpha2: string | null };
type Grant = { countryPlaceId: string; canActivate: boolean; country: Country };
type Policy = {
  id: string; countryPlaceId: string; country: Country; revision: number;
  status: string; allowsDualCitizenship: boolean; minResidenceDays: number;
  proposedByUserId: string;
};
type Treaty = {
  id: string; originCountryId: string; destinationCountryId: string; status: string;
  originCountry: Country; destinationCountry: Country;
  originApprovedByUserId: string | null; destinationApprovedByUserId: string | null;
};
interface GovernanceDeskData {
  grants: Grant[]; policies: Policy[]; agreements: Treaty[];
  countries: Country[]; notice: string;
}
const selectClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground";
const labelClass = "mb-1.5 block text-xs font-semibold text-secondary";

export function CountryGovernanceDesk({ initial, myUserId }: {
  initial: GovernanceDeskData; myUserId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [policyCountryId, setPolicyCountryId] = useState(initial.grants[0]?.countryPlaceId ?? "");
  const [allowsDual, setAllowsDual] = useState(false);
  const [minResidenceDays, setMinResidenceDays] = useState(180);
  const [treatyOrigin, setTreatyOrigin] = useState(initial.grants[0]?.countryPlaceId ?? "");
  const [treatyDestination, setTreatyDestination] = useState(initial.countries[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data: latest } = await apiFetch<GovernanceDeskData>("/api/player-governance");
    if (latest) setData(latest);
    router.refresh();
  }
  async function post(url: string, payload?: unknown) {
    setBusy(true);
    const { error } = await apiFetch(url, {
      method: "POST",
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: "Governance change refused", description: error.message });
      return;
    }
    toast({ variant: "success", title: "SIMVERSE governance updated", description: "The action was recorded in the audit trail." });
    await refresh();
  }

  const canActivate = (countryId: string) =>
    data.grants.some((grant) => grant.countryPlaceId === countryId && grant.canActivate);
  return <div className="space-y-6">
    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-secondary">{data.notice}
      Policies do not correspond to laws of actual countries. Changes require individually provisioned grants.
    </p>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Propose virtual citizenship rules</h2>
        <p className="text-sm text-secondary">Policies are drafts until activated by another authorized country representative.</p>
        <label className={labelClass} htmlFor="gov-country">Authorized country</label>
        <select className={selectClass} id="gov-country" value={policyCountryId}
          onChange={(event) => setPolicyCountryId(event.target.value)}>
          {data.grants.map((g) => <option key={g.countryPlaceId} value={g.countryPlaceId}>{g.country.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={allowsDual} onChange={(event) => setAllowsDual(event.target.checked)}/>
          Allow a second SIMVERSE virtual citizenship
        </label>
        <label className={labelClass} htmlFor="gov-residence">Minimum destination virtual-residence days (0–365)</label>
        <input id="gov-residence" className={selectClass} type="number" min={0} max={365} value={minResidenceDays}
          onChange={(event) => setMinResidenceDays(Number(event.target.value))}/>
        <button type="button" disabled={busy || !policyCountryId} onClick={() => void post(
          "/api/player-governance/policies",
          { countryPlaceId: policyCountryId, allowsDualCitizenship: allowsDual, minResidenceDays },
        )} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
          Submit policy draft
        </button>
      </section>
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Propose bilateral virtual travel waiver</h2>
        <p className="text-sm text-secondary">Both countries must approve the agreement independently before it can waive a SIMVERSE entry visa.</p>
        <label className={labelClass} htmlFor="gov-origin">Proposing virtual country</label>
        <select id="gov-origin" className={selectClass} value={treatyOrigin}
          onChange={(event) => setTreatyOrigin(event.target.value)}>
          {data.grants.map((g) => <option key={g.countryPlaceId} value={g.countryPlaceId}>{g.country.name}</option>)}
        </select>
        <label className={labelClass} htmlFor="gov-destination">Other virtual country</label>
        <select id="gov-destination" className={selectClass} value={treatyDestination}
          onChange={(event) => setTreatyDestination(event.target.value)}>
          {data.countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
        </select>
        <button type="button" disabled={busy || !treatyOrigin || !treatyDestination || treatyOrigin === treatyDestination}
          onClick={() => void post("/api/player-governance/treaties", {
            originCountryId: treatyOrigin, destinationCountryId: treatyDestination,
          })} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
          Propose bilateral agreement
        </button>
      </section>
    </div>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">Virtual citizenship policy versions</h2>
      {!data.policies.length ? <p className="mt-2 text-sm text-muted">No draft or active policies in your assigned countries.</p> :
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{data.policies.map((policy) => (
          <article key={policy.id} className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-semibold">{policy.country.name} · v{policy.revision}</h3>
            <p className="mt-1 text-xs text-secondary">Status: {policy.status}</p>
            <p className="mt-1 text-xs text-secondary">Dual citizenship: {policy.allowsDualCitizenship ? "Permitted" : "Disabled"}</p>
            <p className="mt-1 text-xs text-secondary">Virtual residence: {policy.minResidenceDays} days</p>
            {policy.status === "DRAFT" && policy.proposedByUserId !== myUserId && canActivate(policy.countryPlaceId) ?
              <button type="button" disabled={busy}
                onClick={() => void post(`/api/player-governance/policies/${policy.id}/activate`)}
                className="mt-3 rounded-lg border border-accent/40 px-3 py-2 text-sm text-accent disabled:opacity-50">
                Independently activate
              </button> : null}
          </article>
        ))}</div>}
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">Country-to-country virtual agreements</h2>
      {!data.agreements.length ? <p className="mt-2 text-sm text-muted">No agreements involving your assigned countries.</p> :
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{data.agreements.map((agreement) => (
          <article key={agreement.id} className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-semibold">{agreement.originCountry.name} ↔ {agreement.destinationCountry.name}</h3>
            <p className="mt-1 text-xs text-secondary">Status: {agreement.status}</p>
            <p className="mt-1 text-xs text-secondary">Origin: {agreement.originApprovedByUserId ? "Approved" : "Pending"} ·
              Destination: {agreement.destinationApprovedByUserId ? "Approved" : "Pending"}</p>
            {agreement.status === "DRAFT" && [agreement.originCountryId, agreement.destinationCountryId]
              .filter((id) => canActivate(id)).filter((id) =>
                id === agreement.originCountryId ? !agreement.originApprovedByUserId : !agreement.destinationApprovedByUserId)
              .filter((id) =>
                (id === agreement.originCountryId ? agreement.destinationApprovedByUserId : agreement.originApprovedByUserId) !== myUserId)
              .map((id) => <button type="button" key={id} disabled={busy}
                onClick={() => void post(`/api/player-governance/treaties/${agreement.id}/approve`, { countryPlaceId: id })}
                className="mt-3 mr-2 rounded-lg border border-accent/40 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50">
                Approve for {id === agreement.originCountryId ? agreement.originCountry.name : agreement.destinationCountry.name}
              </button>)}
          </article>
        ))}</div>}
    </section>
  </div>;
}
