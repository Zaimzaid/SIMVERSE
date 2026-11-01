"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";

type Queue = {
  district: { id: string; name: string };
  proposals: { id: string; title: string; description: string; category: string }[];
  cases: {
    id: string; status: string; reviewSummary: string | null; revision: number;
    indicativeCostVC: number | null; candidateSchematicAreaId: string | null;
    proposal: { title: string; status: string };
    publicUpdates: { id: string; kind: string; summary: string }[];
  }[];
  schematicCandidateAreas: { id: string; name: string; zone: string }[];
  virtualDistrictTreasuryVC: number;
  constructionEnabled: false;
  treasurySpendAllowed: false;
  notice: string;
};

export function DevelopmentStaffClient({ initial }: { initial: Queue }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, string>>({});
  const [cost, setCost] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<Record<string, "FEASIBLE_CONCEPT" | "NEEDS_REVISION" | "DECLINED">>({});
  const [area, setArea] = useState<Record<string, string>>({});
  const [updateText, setUpdateText] = useState<Record<string, string>>({});
  const [updateKind, setUpdateKind] = useState<Record<string, string>>({});

  async function act(action: string, body: object) {
    setBusy(true); setFeedback(null);
    const result = await apiFetch("/api/civilization/development/staff", {
      method: "POST", body: JSON.stringify({ action, ...body }),
    });
    setBusy(false);
    if (result.error) { setFeedback(result.error.message); return false; }
    setFeedback("Planning action recorded. No funds, ownership or construction were authorized.");
    router.refresh();
    return true;
  }

  function review(event: FormEvent<HTMLFormElement>, caseId: string) {
    event.preventDefault();
    const raw = cost[caseId]?.trim() ?? "";
    const indicativeCostVC = raw === "" ? null : Number(raw);
    void act("REVIEW", { caseId, decision: decision[caseId] ?? "NEEDS_REVISION",
      summary: summary[caseId] ?? "", indicativeCostVC });
  }

  return <div className="space-y-7">
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-foreground">{initial.district.name} · Feasibility queue</h2>
      <p className="mt-2 text-sm leading-7 text-secondary">
        This screen records staff feasibility decisions and possible schematic sites only.
        The district's {initial.virtualDistrictTreasuryVC} VC treasury cannot be spent here.
      </p>
      <p className="mt-2 text-sm text-secondary">{initial.notice}</p>
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">
        Assembly-shortlisted ideas ({initial.proposals.length})
      </h2>
      {!initial.proposals.length && <p className="text-sm text-secondary">
        No shortlisted ideas are waiting for staff intake.
      </p>}
      {initial.proposals.map((p) => <article key={p.id}
        className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{p.category}</p>
        <h3 className="mt-2 font-semibold text-foreground">{p.title}</h3>
        <p className="mt-2 text-sm leading-7 text-secondary">{p.description}</p>
        <button type="button" disabled={busy}
          onClick={() => act("START", { proposalId: p.id })}
          className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">
          Open staff feasibility case
        </button>
      </article>)}
    </section>
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Active feasibility records</h2>
      {initial.cases.map((c) => <article key={c.id}
        className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {c.status.replaceAll("_", " ")}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">{c.proposal.title}</h3>
          {c.reviewSummary && <p className="mt-2 text-sm leading-7 text-secondary">
            Internal review: {c.reviewSummary}
          </p>}
          {c.indicativeCostVC !== null && <p className="mt-2 text-sm text-secondary">
            Indicative (unfunded) virtual cost: {c.indicativeCostVC.toLocaleString()} VC
          </p>}
        </div>
        {["FEASIBILITY_REVIEW", "NEEDS_REVISION"].includes(c.status) &&
          <form onSubmit={(e) => review(e, c.id)} className="space-y-3">
            <label htmlFor={`review-choice-${c.id}`} className="block text-sm font-semibold">
              Independent staff review
            </label>
            <select id={`review-choice-${c.id}`}
              value={decision[c.id] ?? "NEEDS_REVISION"}
              onChange={(e) => setDecision((v) => ({ ...v, [c.id]: e.target.value as "FEASIBLE_CONCEPT" | "NEEDS_REVISION" | "DECLINED" }))}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
              <option value="NEEDS_REVISION">Needs further study</option>
              <option value="FEASIBLE_CONCEPT">Feasible as a concept only</option>
              <option value="DECLINED">Not feasible</option>
            </select>
            <label htmlFor={`review-summary-${c.id}`} className="block text-sm font-semibold">Reasoned assessment</label>
            <textarea id={`review-summary-${c.id}`} required minLength={30} maxLength={1800}
              rows={3} value={summary[c.id] ?? ""}
              onChange={(e) => setSummary((v) => ({ ...v, [c.id]: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
            <label htmlFor={`review-cost-${c.id}`} className="block text-sm font-semibold">
              Optional illustrative cost (VC; not an allocation)
            </label>
            <input id={`review-cost-${c.id}`} type="number" min={0} max={100000000} step={1}
              value={cost[c.id] ?? ""}
              onChange={(e) => setCost((v) => ({ ...v, [c.id]: e.target.value }))}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />
            <button type="submit" disabled={busy}
              className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50">
              Record feasibility decision
            </button>
          </form>}
        {c.status === "FEASIBLE_CONCEPT" && <div className="space-y-3">
          <label htmlFor={`site-${c.id}`} className="block text-sm font-semibold">
            Optional schematic planning candidate (not a real site)
          </label>
          <select id={`site-${c.id}`} value={area[c.id] ?? ""}
            onChange={(e) => setArea((v) => ({ ...v, [c.id]: e.target.value }))}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
            <option value="">Choose a diagrammatic area</option>
            {initial.schematicCandidateAreas.map((a) => <option key={a.id} value={a.id}>
              {a.name} · {a.zone}
            </option>)}
          </select>
          <button type="button" disabled={busy || !area[c.id]}
            onClick={() => act("SCHEMATIC_CANDIDATE", { caseId: c.id, areaId: area[c.id] })}
            className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50">
            Save planning candidate only
          </button>
          {c.candidateSchematicAreaId && <p className="text-xs text-secondary">
            Schematic candidate recorded. This is not a land reservation or building permit.
          </p>}
        </div>}
        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
          <h4 className="text-sm font-semibold text-foreground">Publish a factual planning update</h4>
          <label htmlFor={`update-kind-${c.id}`} className="sr-only">Update category</label>
          <select id={`update-kind-${c.id}`} value={updateKind[c.id] ?? "GEO_DEPENDENCY"}
            onChange={(e) => setUpdateKind((v) => ({ ...v, [c.id]: e.target.value }))}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm">
            <option value="REVIEW">Feasibility review</option>
            <option value="COMMUNITY_CONSULTATION">Community consultation</option>
            <option value="GEO_DEPENDENCY">Waiting for approved geography</option>
            <option value="HOLD">Planning on hold</option>
          </select>
          <label htmlFor={`update-text-${c.id}`} className="sr-only">Public planning update</label>
          <textarea id={`update-text-${c.id}`} rows={2} minLength={15} maxLength={800}
            value={updateText[c.id] ?? ""}
            onChange={(e) => setUpdateText((v) => ({ ...v, [c.id]: e.target.value }))}
            className="w-full rounded-xl border border-border bg-surface p-3 text-sm"
            placeholder="Explain the current review status. Do not promise construction." />
          <button type="button" disabled={busy || (updateText[c.id] ?? "").trim().length < 15}
            onClick={() => act("UPDATE", { caseId: c.id,
              kind: updateKind[c.id] ?? "GEO_DEPENDENCY", summary: updateText[c.id] })}
            className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50">
            Publish planning update
          </button>
        </div>
      </article>)}
    </section>
    {feedback && <p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground">
      {feedback}
    </p>}
  </div>;
}
