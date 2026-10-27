import { BadgeCheck, CalendarDays, Fingerprint, IdCard, ShieldAlert, Stamp } from "lucide-react";
import { documentDisplayStatus, type VirtualDocumentKind } from "@/lib/player-identity/documents";

/**
 * Read-only OWNER-ONLY credentials. Visuals deliberately use original
 * SIMVERSE world styling, not any government seal, flag, MRZ or real ID form.
 * Rendering here never creates, renews, approves or validates a credential.
 */
export interface VirtualCredentialApplicant {
  displayName: string;
  username: string | null;
  simverseId: string;
  avatarUrl: string | null;
}
type Country = { id: string; name: string; isoAlpha2: string | null };
export type CredentialApplication = {
  id: string;
  kind: string;
  status: string;
  country: Country;
  document: null | {
    serial: string;
    status: string;
    issuedAt: Date | string;
    expiresAt: Date | string;
    displayStatus: string;
  };
};

const credentialLabels: Record<VirtualDocumentKind, string> = {
  CITIZENSHIP: "Virtual Citizen ID",
  RESIDENCY: "Virtual Residency Card",
  NATIONAL_PASSPORT: "National Virtual Passport",
  INTERNATIONAL_PASSPORT: "International Virtual Passport",
};

function formatDate(date: string | Date): string {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", year: "numeric",
  }).format(value);
}

function Status({ status }: { status: "VALID" | "EXPIRED" | "REVOKED" }) {
  const styles = {
    VALID: "border-emerald-300/40 bg-emerald-300/15 text-emerald-100",
    EXPIRED: "border-amber-300/45 bg-amber-300/15 text-amber-100",
    REVOKED: "border-red-300/45 bg-red-300/15 text-red-100",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.11em] ${styles[status]}`}>
    {status}
  </span>;
}

function PlayerPortrait({ applicant }: { applicant: VirtualCredentialApplicant }) {
  const initials = applicant.displayName.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "SV";
  return <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white/10 text-xl font-bold text-white sm:h-28 sm:w-24"
    aria-label="Player avatar">
    {applicant.avatarUrl ? (
      // Player avatar is the owner's existing profile URL; the system does not use any real government photo.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={applicant.avatarUrl} alt={`${applicant.displayName}'s SIMVERSE avatar`} className="h-full w-full object-cover" />
    ) : initials}
  </div>;
}

function Fact({ label, value, contrast = "dark" }: {
  label: string; value: string; contrast?: "light" | "dark";
}) {
  return <div className="min-w-0">
    <dt className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${contrast === "light" ? "text-white/55" : "text-slate-500"}`}>
      {label}
    </dt>
    <dd className={`mt-1 break-words text-xs font-semibold sm:text-sm ${contrast === "light" ? "text-white" : "text-slate-900"}`}>
      {value}
    </dd>
  </div>;
}

/** Plastic card inspired by collectible fictional game identity cards. */
function IdentityCard({ application, applicant }: {
  application: CredentialApplication; applicant: VirtualCredentialApplicant;
}) {
  const doc = application.document!;
  const kind = application.kind as VirtualDocumentKind;
  const status = documentDisplayStatus({
    status: doc.status, expiresAt: new Date(doc.expiresAt),
  });
  const residency = kind === "RESIDENCY";
  return (
    <article className="min-w-0">
      <div className={`relative isolate overflow-hidden rounded-[1.5rem] border border-white/25 p-5 shadow-xl sm:p-6
        ${residency ? "bg-gradient-to-br from-[#214b4c] via-[#116767] to-[#14394c]" :
        "bg-gradient-to-br from-[#171a46] via-[#243c83] to-[#185d78]"}`}>
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border-[35px] border-white/[0.06]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 right-6 size-56 rounded-full border-[28px] border-cyan-200/[0.07]" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-100">SIMVERSE WORLD</p>
            <h3 className="mt-1 font-display text-base font-semibold text-white sm:text-lg">
              {credentialLabels[kind]}
            </h3>
            <p className="mt-1 text-xs text-white/70">{application.country.name} · Fictional world</p>
          </div>
          <Status status={status} />
        </div>
        <div className="relative mt-6 flex min-w-0 gap-4">
          <PlayerPortrait applicant={applicant} />
          <dl className="grid min-w-0 flex-1 grid-cols-1 gap-3">
            <Fact contrast="light" label="Player name" value={applicant.displayName} />
            <Fact contrast="light" label="SIMVERSE ID" value={applicant.simverseId} />
            <Fact contrast="light" label="Username" value={applicant.username ? `@${applicant.username}` : "Not set"} />
          </dl>
        </div>
        <dl className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
          <Fact contrast="light" label="Date issued" value={formatDate(doc.issuedAt)} />
          <Fact contrast="light" label="Expiry date" value={formatDate(doc.expiresAt)} />
          <div className="col-span-2">
            <Fact contrast="light" label="Document reference" value={doc.serial} />
          </div>
        </dl>
        <div className="relative mt-5 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[10px] font-semibold tracking-wide text-white/80">
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
          VIRTUAL GAME CREDENTIAL · NOT GOVERNMENT IDENTIFICATION
        </div>
      </div>
      <p className="mt-2 px-2 text-xs text-muted">Issued only after an independent SIMVERSE review. Card validity is separate from citizenship status.</p>
    </article>
  );
}

/** A game-world passport-inspired booklet; intentionally NOT an authentic
 * passport data page, official emblem, travel visa or machine-readable ID. */
function PassportBooklet({ application, applicant }: {
  application: CredentialApplication; applicant: VirtualCredentialApplicant;
}) {
  const doc = application.document!;
  const international = application.kind === "INTERNATIONAL_PASSPORT";
  const status = documentDisplayStatus({
    status: doc.status, expiresAt: new Date(doc.expiresAt),
  });
  return (
    <article className="min-w-0 overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-lg">
      <div className="grid min-w-0 sm:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <div className={`relative flex min-h-[260px] flex-col items-center justify-between overflow-hidden border-b border-white/15 px-5 py-6 text-center text-white sm:border-b-0 sm:border-r
          ${international ? "bg-gradient-to-br from-[#14284c] via-[#0c5475] to-[#102443]" :
          "bg-gradient-to-br from-[#40254e] via-[#604078] to-[#2f1e4a]"}`}>
          <div className="absolute inset-y-0 left-1.5 w-1 rounded-full bg-black/25" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-[0.27em] text-white/75">SIMVERSE WORLD</p>
          <div className="flex flex-col items-center gap-3">
            <span className="flex size-20 items-center justify-center rounded-full border-2 border-[#c5e6e4]/70 bg-white/10">
              <Stamp className="size-11 text-[#c5e6e4]" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-bold uppercase tracking-[0.1em]">
                {international ? "International" : "National"}
              </p>
              <p className="font-display text-xl font-bold uppercase tracking-[0.22em]">Virtual Passport</p>
            </div>
            <p className="text-xs text-white/80">{application.country.name} · SIMVERSE</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
            FICTIONAL TRAVEL BOOKLET
          </p>
        </div>

        <div className="min-w-0 bg-[#f3f1e7] p-5 text-slate-900 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-slate-600">SIMVERSE · DIGITAL RECORD</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">Passport details</h3>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase
              ${status === "VALID" ? "border-emerald-700/30 bg-emerald-100 text-emerald-900" :
              status === "EXPIRED" ? "border-amber-700/30 bg-amber-100 text-amber-950" : "border-red-700/30 bg-red-100 text-red-900"}`}>
              {status}
            </span>
          </div>
          <div className="mt-4 flex min-w-0 items-start gap-4">
            <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-300 font-bold text-slate-700">
              {applicant.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={applicant.avatarUrl} alt={`${applicant.displayName}'s SIMVERSE avatar`} className="h-full w-full object-cover" />
              ) : applicant.displayName.trim().slice(0, 2).toUpperCase()}
            </div>
            <dl className="grid min-w-0 flex-1 gap-3">
              <Fact label="Player name" value={applicant.displayName} />
              <Fact label="SIMVERSE ID" value={applicant.simverseId} />
              <Fact label="Username" value={applicant.username ? `@${applicant.username}` : "Not set"} />
            </dl>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-slate-300 pt-4">
            <Fact label="Virtual country" value={application.country.name} />
            <Fact label="Type" value={international ? "International" : "National"} />
            <Fact label="Issue date" value={formatDate(doc.issuedAt)} />
            <Fact label="Expiry date" value={formatDate(doc.expiresAt)} />
            <div className="col-span-2"><Fact label="Document reference" value={doc.serial} /></div>
          </dl>
          <p className="mt-5 border-t border-slate-300 pt-3 text-[10px] font-bold uppercase tracking-[0.10em] text-slate-700">
            NOT A REAL PASSPORT · NOT VALID FOR BORDER CROSSING
          </p>
        </div>
      </div>
    </article>
  );
}

export function VirtualCredentialGallery({ applications, applicant }: {
  applications: CredentialApplication[];
  applicant: VirtualCredentialApplicant;
}) {
  const issued = applications.filter((application) =>
    application.status === "APPROVED" && application.document !== null &&
    (["CITIZENSHIP", "RESIDENCY", "NATIONAL_PASSPORT", "INTERNATIONAL_PASSPORT"] as string[]).includes(application.kind),
  );
  return (
    <section aria-labelledby="credential-wallet-heading" className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Your document wallet</p>
            <h2 id="credential-wallet-heading" className="mt-1 font-display text-xl font-semibold text-foreground">
              Virtual ID cards & passports
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-secondary">
              Once an authorized SIMVERSE reviewer approves your application, your credential appears here as a virtual card or passport booklet.
              Issue and expiry dates come from your approved document record.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-accent">
            <IdCard className="size-4" aria-hidden /> {issued.length} issued
          </div>
        </div>
        {!issued.length ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed border-border-strong bg-background p-5">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">Your virtual card collection is empty</p>
              <p className="mt-1 text-sm text-secondary">Submit an application below. A pending or denied application never produces a valid document.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 2xl:grid-cols-2">
            {issued.map((application) => (
              application.kind === "NATIONAL_PASSPORT" || application.kind === "INTERNATIONAL_PASSPORT" ?
                <PassportBooklet key={application.id} application={application} applicant={applicant} /> :
                <IdentityCard key={application.id} application={application} applicant={applicant} />
            ))}
          </div>
        )}
        <p className="mt-5 flex items-center gap-2 text-xs text-muted">
          <Fingerprint className="size-4 shrink-0" aria-hidden />
          These are private fictional game credentials. They cannot replace identity cards, nationality documents or passports from any country.
        </p>
      </div>
    </section>
  );
}
