"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, BriefcaseBusiness, GraduationCap, ShieldAlert, Users } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client/api";
import { SIMVERSE_PROFESSIONS } from "@/lib/player-identity/economy";

type B = { id: string; name: string; status: string; sector: string; reviewNote: string | null };
type Application = { id: string; status: string; statement: string; createdAt: string | Date;
  applicant?: { username: string | null; user: { displayName: string } };
};
type Job = { id: string; title: string; description: string; professionCode: string;
  status: string; business: { id: string; name: string; sector: string }; applications?: Application[] };
type Mine = { id: string; status: string; statement: string;
  job: Job; employment: { id: string; startedAt: string | Date; status: string } | null };
export interface WorkCenterData {
  businesses: B[];
  jobs: Job[];
  applications: Mine[];
  availableJobs: Job[];
  orientation: { professionCode: string; earnedAt: string | Date; score: number } | null;
  usernameSet: boolean;
  notice: string;
}
export interface WorkQuestionsData {
  professionCode: string | null; version: number;
  questions: Array<{ id: string; question: string; options: string[] }>;
  certificate: { professionCode: string; earnedAt: string | Date; score: number } | null;
  notice: string;
}
const input = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground";
const btn = "rounded-xl border border-accent/50 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-40";
const heading = "text-lg font-semibold text-foreground";
export function PlayerWorkCenter({ initial, initialQuestions }: {
  initial: WorkCenterData; initialQuestions: WorkQuestionsData;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState(initial);
  const [questions, setQuestions] = useState(initialQuestions);
  const [answers, setAnswers] = useState<number[]>([-1, -1, -1]);
  const [newJob, setNewJob] = useState({ businessId: "", title: "", description: "", professionCode: initialQuestions.professionCode ?? "COMMERCE" });
  const [statements, setStatements] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ready = Boolean(data.orientation);

  async function refresh() {
    const [work, orientation] = await Promise.all([
      apiFetch<WorkCenterData>("/api/player-work"),
      apiFetch<WorkQuestionsData>("/api/player-work/orientation"),
    ]);
    if (work.data) setData(work.data);
    if (orientation.data) setQuestions(orientation.data);
    router.refresh();
  }
  async function action(url: string, body: unknown, success: string) {
    setBusy(true);
    const { error } = await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
    if (error) toast({ variant: "error", title: "SIMVERSE action refused", description: error.message });
    else {
      toast({ variant: "success", title: success, description: "Saved to the fictional SIMVERSE work records." });
      await refresh();
    }
    setBusy(false);
    return !error;
  }
  const approvedBusinesses = data.businesses.filter((b) => b.status === "APPROVED");
  return <div className="space-y-6">
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-secondary">
      <p className="flex items-start gap-2 font-semibold text-amber-200"><ShieldAlert className="mt-0.5 size-4 shrink-0"/>{data.notice}</p>
      <p className="mt-2 text-xs">No simulated contract creates real employment, earnings or licensing rights.</p>
    </div>
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className={heading}><GraduationCap className="mr-2 inline size-5 text-accent"/>Introductory career orientation</h2>
      {ready ? <div className="mt-3 rounded-lg border border-border bg-background p-4">
        <p className="flex items-center gap-2 font-semibold text-accent"><BadgeCheck className="size-4"/>Orientation completed</p>
        <p className="mt-1 text-sm text-secondary">Career: {data.orientation?.professionCode.replaceAll("_"," ")} · Score: {data.orientation?.score}/3</p>
        <p className="mt-2 text-xs text-muted">This is an introductory in-world activity, not a verified professional qualification.</p>
      </div> : <div className="mt-3 space-y-4">
        {!questions.professionCode ? <p className="text-sm text-secondary">
          <Link href="/profile/career" className="font-semibold text-accent underline">Choose your SIMVERSE profession</Link> before beginning.
        </p> : <p className="text-sm text-secondary">
          Complete the three conduct and safety questions. All answers must be correct for this pilot.
        </p>}
        {questions.professionCode && questions.questions.map((q, index) => <fieldset key={q.id}
          className="rounded-xl border border-border bg-background p-4">
          <legend className="px-1 text-sm font-semibold">{index + 1}. {q.question}</legend>
          <div className="mt-2 space-y-2">{q.options.map((option, choice) => <label key={choice}
            className="flex cursor-pointer items-start gap-2 text-sm text-secondary">
            <input type="radio" name={q.id} checked={answers[index] === choice}
              onChange={() => setAnswers((old) => old.map((a, i) => i === index ? choice : a))}/>
            {option}
          </label>)}</div>
        </fieldset>)}
        {questions.professionCode ? <button type="button" disabled={busy || !data.usernameSet || answers.some((a) => a < 0)}
          onClick={() => void action("/api/player-work/orientation", { answers }, "Orientation completed")}
          className={btn}>Submit orientation answers</button> : null}
      </div>}
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className={heading}><BriefcaseBusiness className="mr-2 inline size-5 text-accent"/>My virtual companies</h2>
      <p className="mt-2 text-sm text-secondary">Create drafts in <Link href="/profile/career" className="text-accent underline">My Career</Link>, then request a separate business review.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.businesses.map((b) => <article key={b.id}
        className="rounded-xl border border-border bg-background p-4">
        <h3 className="font-semibold">{b.name}</h3>
        <p className="mt-1 text-xs text-secondary">{b.sector} · <strong>{b.status.replaceAll("_", " ")}</strong></p>
        {b.reviewNote ? <p className="mt-2 text-xs text-muted">Review note: {b.reviewNote}</p> : null}
        {b.status === "DRAFT" && ready ? <button type="button" disabled={busy}
          className={`mt-3 ${btn}`} onClick={() => void action(`/api/player-work/businesses/${b.id}/submit`, {}, "Company submitted for independent review")}>
          Submit for approval
        </button> : null}
      </article>)}
      {!data.businesses.length ? <p className="text-sm text-muted">No company drafts yet.</p> : null}</div>
      <p className="mt-3 text-xs text-muted">All submissions start pending; only a specially authorized business reviewer may approve them.</p>
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className={heading}><Users className="mr-2 inline size-5 text-accent"/>Post a virtual job</h2>
      <p className="mt-2 text-sm text-secondary">Only approved businesses may post; no salaries or wallet transfers are performed.</p>
      {approvedBusinesses.length && ready ? <form className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => { e.preventDefault(); void action("/api/player-work/jobs", newJob, "Vacancy published").then((ok) => {
          if (ok) setNewJob({ ...newJob, title: "", description: "" });
        }); }}>
        <label className="text-xs text-secondary">Company
          <select className={`mt-1 ${input}`} required value={newJob.businessId}
            onChange={(e) => setNewJob({ ...newJob, businessId: e.target.value })}>
            <option value="">Select approved company</option>
            {approvedBusinesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-secondary">Profession
          <select className={`mt-1 ${input}`} value={newJob.professionCode}
            onChange={(e) => setNewJob({ ...newJob, professionCode: e.target.value })}>
            {SIMVERSE_PROFESSIONS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-secondary sm:col-span-2">Job title
          <input className={`mt-1 ${input}`} value={newJob.title} minLength={5} maxLength={80} required
            onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}/>
        </label>
        <label className="text-xs text-secondary sm:col-span-2">Description
          <textarea className={`mt-1 ${input}`} rows={3} value={newJob.description} minLength={15} maxLength={1000} required
            onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}/>
        </label>
        <button className={btn} disabled={busy || !newJob.businessId} type="submit">Publish virtual vacancy</button>
      </form> : <p className="mt-3 text-sm text-muted">An approved company and completed orientation are required to post jobs.</p>}
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className={heading}>Browse SIMVERSE jobs</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.availableJobs.map((job) => {
        const mine = data.applications.some((a) => a.job.id === job.id);
        const own = data.businesses.some((b) => b.id === job.business.id);
        return <article key={job.id} className="rounded-xl border border-border bg-background p-4">
          <h3 className="font-semibold">{job.title}</h3>
          <p className="mt-1 text-xs text-secondary">{job.business.name} · {job.professionCode}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{job.description}</p>
          {!own && !mine && ready && job.professionCode === data.orientation?.professionCode ? <>
            <label className="mt-3 block text-xs text-secondary" htmlFor={`apply-${job.id}`}>Why are you interested?</label>
            <textarea id={`apply-${job.id}`} rows={3} className={`mt-1 ${input}`}
              value={statements[job.id] ?? ""} maxLength={500}
              onChange={(e) => setStatements((s) => ({ ...s, [job.id]: e.target.value }))}/>
            <button className={`mt-2 ${btn}`} type="button" disabled={busy || (statements[job.id]?.trim().length ?? 0) < 10}
              onClick={() => void action(`/api/player-work/jobs/${job.id}/apply`,
                { statement: statements[job.id] }, "SIMVERSE application submitted")}>Apply</button>
          </> : <p className="mt-3 text-xs text-muted">
            {own ? "Your company's posting" : mine ? "Already applied" : "Requires matching introductory profession orientation"}
          </p>}
        </article>;
      })}
      {!data.availableJobs.length ? <p className="text-sm text-muted">No approved SIMVERSE jobs are currently open.</p> : null}</div>
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className={heading}>My applications & employment</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {data.applications.map((application) => <article key={application.id} className="rounded-xl border border-border bg-background p-4">
          <h3 className="font-semibold">{application.job.title}</h3>
          <p className="mt-1 text-xs text-secondary">{application.job.business.name} · <strong>{application.status}</strong></p>
          {application.status === "OFFERED" ? <div className="mt-3 flex gap-2">
            <button type="button" className={btn} disabled={busy} onClick={() =>
              void action(`/api/player-work/applications/${application.id}/offer`, { decision: "ACCEPT" }, "Offer accepted")}>Accept offer</button>
            <button type="button" className={btn} disabled={busy} onClick={() =>
              void action(`/api/player-work/applications/${application.id}/offer`, { decision: "DECLINE" }, "Offer declined")}>Decline</button>
          </div> : null}
          {application.employment ? <p className="mt-3 text-xs text-accent">Fictional employment active since {new Date(application.employment.startedAt).toLocaleDateString()}</p> : null}
        </article>)}
        {!data.applications.length ? <p className="text-sm text-muted">No applications or contracts recorded.</p> : null}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className={heading}>My companies' applicants</h2>
      <div className="mt-3 space-y-4">{data.jobs.map((job) => <article key={job.id} className="rounded-xl border border-border bg-background p-4">
        <h3 className="font-semibold">{job.title} · {job.status.replaceAll("_"," ")}</h3>
        <p className="mb-2 text-xs text-muted">{job.business.name}</p>
        {job.applications?.map((application) => <div key={application.id} className="border-t border-border py-3">
          <p className="text-sm font-semibold">{application.applicant?.user.displayName} (@{application.applicant?.username}) · {application.status}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-secondary">{application.statement}</p>
          {application.status === "SUBMITTED" && <div className="mt-2 flex gap-2">
            <button type="button" className={btn} disabled={busy || job.status !== "OPEN"}
              onClick={() => void action(`/api/player-work/applications/${application.id}/employer`, { decision: "OFFER" }, "Offer sent")}>Offer</button>
            <button type="button" className={btn} disabled={busy}
              onClick={() => void action(`/api/player-work/applications/${application.id}/employer`, { decision: "REJECT" }, "Application rejected")}>Reject</button>
          </div>}
        </div>)}
        {!job.applications?.length ? <p className="text-sm text-muted">No applicants yet.</p> : null}
      </article>)}
      {!data.jobs.length ? <p className="text-sm text-muted">Your approved virtual companies have no job postings.</p> : null}
      </div>
    </section>
  </div>;
}
