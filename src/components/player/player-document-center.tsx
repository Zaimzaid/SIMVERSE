"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, FileBadge2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import { qualificationChecklist, type VirtualDocumentKind } from "@/lib/player-identity/documents";
import { VirtualCredentialGallery, type VirtualCredentialApplicant } from "./virtual-credential-gallery";

type Country = { id: string; name: string; isoAlpha2: string | null };
type Application = {
  id: string; kind: string; status: string; statement: string;
  reviewNote: string | null; createdAt: string | Date;
  country: Country;
  document: null | {
    serial: string; status: string; expiresAt: string | Date;
    issuedAt: string | Date; displayStatus: string;
  };
};
export type VirtualDocumentsInitial = {
  applications: Application[];
  citizenships: Array<{ id: string; status: string; country: Country }>;
  countries: Country[];
  notice: string;
};
const kinds = [
  ["CITIZENSHIP", "Virtual citizenship"],
  ["NATIONAL_PASSPORT", "National SIMVERSE passport"],
  ["INTERNATIONAL_PASSPORT", "International SIMVERSE passport"],
  ["RESIDENCY", "Virtual residency permit"],
] as const;
const field = "w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-accent";

export function PlayerDocumentCenter({
  initial, username, homeCountryId, applicant,
}: { initial: VirtualDocumentsInitial; username: string | null; homeCountryId: string | null;
  applicant: VirtualCredentialApplicant }) {
  const router = useRouter();
  const { toast } = useToast();
  const [applications, setApplications] = useState(initial.applications);
  // Reflect a separate reviewer’s approval when the page is refreshed.
  useEffect(() => setApplications(initial.applications), [initial.applications]);
  const [kind, setKind] = useState<VirtualDocumentKind>("CITIZENSHIP");
  const [countryPlaceId, setCountryPlaceId] = useState(initial.countries[0]?.id ?? "");
  const [statement, setStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checks = qualificationChecklist({
    kind, hasUsername: Boolean(username),
    homeCountryMatches: homeCountryId === countryPlaceId,
    hasActiveVirtualCitizenship: initial.citizenships.some((c) =>
      c.status === "ACTIVE" && c.country.id === countryPlaceId),
  });
  const eligible = countryPlaceId.length > 0 && checks.every((check) => check.satisfied);
  const existing = applications.some((app) => app.kind === kind && app.country.id === countryPlaceId);

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const { data, error } = await apiFetch<{ application: Application }>("/api/player-documents/applications", {
      method: "POST",
      body: JSON.stringify({ kind, countryPlaceId, statement }),
    });
    setSubmitting(false);
    if (error) {
      toast({ variant: "error", title: "Application not submitted", description: error.message });
      return;
    }
    if (data?.application) {
      setApplications((rows) => [data.application, ...rows]);
      setStatement("");
      toast({ variant: "success", title: "Application submitted", description: "Awaiting authorized SIMVERSE review." });
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="flex items-start gap-2 text-sm text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />{initial.notice}
        </p>
        <p className="mt-2 text-xs text-secondary">This pilot does not charge fees or allow players to issue their own documents.
          Country-specific legal travel rights are not implemented.</p>
      </div>

      <VirtualCredentialGallery applications={applications} applicant={applicant} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={apply} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FileBadge2 className="size-5 text-accent" />Apply for virtual documents</h2>
          <div><label htmlFor="virtual-kind" className="mb-1.5 block text-xs font-semibold text-secondary">Document type</label>
            <select id="virtual-kind" className={field} value={kind} onChange={(e) => setKind(e.target.value as VirtualDocumentKind)}>
              {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div><label htmlFor="virtual-country" className="mb-1.5 block text-xs font-semibold text-secondary">Virtual country</label>
            <select id="virtual-country" className={field} value={countryPlaceId}
              onChange={(e) => setCountryPlaceId(e.target.value)} disabled={!initial.countries.length}>
              {initial.countries.length ? initial.countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) :
                <option value="">No active country available</option>}
            </select>
          </div>
          <div><label htmlFor="virtual-statement" className="mb-1.5 block text-xs font-semibold text-secondary">Application statement (optional)</label>
            <textarea id="virtual-statement" rows={3} maxLength={500} className={field} value={statement}
              onChange={(e) => setStatement(e.target.value)} placeholder="Explain your character's application…"/>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Pilot qualification checklist</p>
            {checks.map((check) => <p key={check.id} className="mb-1 text-sm text-secondary">
              {check.satisfied ? "✓" : "○"} {check.description}
            </p>)}
          </div>
          <button type="submit" disabled={!eligible || existing || submitting}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "Submitting…" : existing ? "Already applied for this type and country" : eligible ? "Submit for review" : "Requirements not met"}
          </button>
          {!username && <p className="text-xs text-secondary">You need a SIMVERSE username. <Link className="text-accent underline" href="/profile">Complete your identity</Link>.</p>}
        </form>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><BadgeCheck className="size-5 text-accent"/>Your virtual citizenship</h2>
          {initial.citizenships.length ? initial.citizenships.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-background p-3">
              <p className="font-medium">{c.country.name}</p>
              <p className="text-xs text-secondary">{c.status === "ACTIVE" ? "Approved SIMVERSE virtual citizenship" : c.status.replaceAll("_"," ")}</p>
            </div>
          )) : <p className="text-sm text-secondary">No virtual citizenship has been approved. Selecting a home country doesn't grant citizenship.</p>}
          <p className="pt-2 text-xs text-muted">Residency and passports require separate applications. No real nationality or immigration status is represented.</p>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Application history & virtual credentials</h2>
        <p className="mt-1 text-sm text-secondary">Only you and separately authorized country reviewers can access these records.</p>
        {!applications.length ? <p className="mt-4 text-sm text-muted">No applications submitted yet.</p> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {applications.map((app) => <div key={app.id} className="rounded-xl border border-border bg-background p-4">
              <p className="font-medium">{kinds.find(([id]) => id === app.kind)?.[1] ?? app.kind}</p>
              <p className="text-xs text-secondary">{app.country.name}</p>
              <p className="mt-2 text-sm">Status: <strong>{app.status.replaceAll("_", " ")}</strong></p>
              {app.reviewNote && <p className="mt-2 text-xs text-secondary">Review note: {app.reviewNote}</p>}
              {app.document && <a href="#credential-wallet-heading" className="mt-3 inline-flex text-xs font-semibold text-accent hover:underline">
                View your issued virtual credential ↑
              </a>}
              {app.status === "APPROVED" && !app.document && <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                Historical approval without a credential record. An authorized SIMVERSE operator must issue a dated record.
              </p>}
            </div>)}
          </div>
        )}
      </section>
      <p className="text-xs text-muted">A denied application cannot be resubmitted for the same type and country in this pilot.
        Future policy phases will add appeals, renewal and revocation workflows.</p>
    </div>
  );
}
