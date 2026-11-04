import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import type {Metadata} from "next";
import {ArrowLeft,ArrowRight,Download,ShieldCheck} from "lucide-react";
import {getSessionUser} from "@/server/auth/session";
import {getPlatformStaff,isAdminStepupValid} from "@/server/admin/access";
import {allowedAdminSections,isAdminRole,readDeniedAdminSections,ADMIN_SECTION_LABELS,type AdminSection} from "@/lib/admin/permissions";
import {getPlatformOverview,listAdminAudit,listAdminCitizens,listAdminWorkspaces,listAdminStaff,parseAdminEventFilter,parseAdminAuditWindow,ADMIN_EVENT_FILTERS,ADMIN_AUDIT_WINDOWS} from "@/server/admin/service";
import {getAdminMonitoring} from "@/server/admin/monitoring";
import {AdminMonitoringPanel} from "@/components/admin/admin-monitoring-panel";
import {AdminRefresh} from "@/components/admin/admin-refresh";
import {AdminStaffPanel} from "@/components/admin/admin-staff-panel";

export const metadata:Metadata={title:"KAVANDRO | Platform administration",robots:{index:false,follow:false}};
function href(view:AdminSection,page=0,filter="all",q="",window="7d"){
 const args=new URLSearchParams({view,page:String(Math.max(0,page))});
 if(view==="activity")args.set("filter",filter);
 if(view==="activity"||view==="security"||view==="civilization")args.set("window",window);
 if(view==="citizens"&&q)args.set("q",q);
 return "/admin?"+args.toString();
}
export default async function AdminPage({searchParams}:{searchParams:Promise<{view?:string;page?:string;filter?:string;q?:string;window?:string}>}){
 const user=await getSessionUser();
 if(!user)redirect("/login?next="+encodeURIComponent("/admin"));
 const staff=await getPlatformStaff(user.id);
 if(!staff?.active||!isAdminRole(staff.role))notFound();
 if(!user.twoFactorEnabledAt||!await isAdminStepupValid(user.id))redirect("/admin/access");
 const sections=allowedAdminSections(staff.role,readDeniedAdminSections(staff.deniedSections));
 if(!sections.length)return <main className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-2xl font-bold">No dashboard sections assigned</h1>
  <p className="text-secondary">Ask the platform owner to grant your account access.</p><Link className="text-accent underline" href="/dashboard">Return to platform</Link></main>;
 const params=await searchParams;
 const view:AdminSection=sections.includes(params.view as AdminSection) ? (params.view as AdminSection) : (sections[0] ?? "overview");
 const page=Math.max(0,Math.min(1000,Number.parseInt(params.page??"0",10)||0));
 const filter=view==="security"?"security":view==="civilization"?"civilization":parseAdminEventFilter(params.filter);
 const q=params.q??"";
 const window=parseAdminAuditWindow(params.window);
 const overview=view==="overview"?await getPlatformOverview():null;
 const monitoring=view==="overview"?await getAdminMonitoring():null;
 const logs=(view==="activity"||view==="security"||view==="civilization")?
  await listAdminAudit(filter,page,view,window):null;
 const people=view==="citizens"?await listAdminCitizens(q,page):null;
 const organizations=view==="workspaces"?await listAdminWorkspaces(page):null;
 const team=view==="staff"?await listAdminStaff():null;
 const paged=logs??people??organizations;
 const total=paged?.total??0;
 const activePage=paged?.page??0;
 const perPage=paged?.limit??30;
 return <main className="mx-auto max-w-[1440px] space-y-7 px-4 py-7 sm:px-8">
  <header className="flex flex-wrap items-start justify-between gap-5 rounded-3xl border border-border bg-surface p-6">
   <div className="space-y-2"><Link className="inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline" href="/dashboard">
    <ArrowLeft className="size-4"/> KAVANDRO</Link>
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Restricted operations</p>
    <h1 className="text-3xl font-bold tracking-tight">Platform administration</h1>
    <p className="max-w-2xl text-sm text-secondary">Monitor recorded activities and manage the staff allowed to operate KAVANDRO.</p>
    <p className="flex items-center gap-2 text-xs text-muted"><ShieldCheck className="size-4"/> {user.email} · {staff.role} · Authenticator verified</p>
   </div><AdminRefresh/>
  </header>
  <nav aria-label="Admin dashboard sections" className="flex flex-wrap gap-2">
   {sections.map(section=><Link key={section} href={href(section)}
    aria-current={section===view?"page":undefined}
    className={section===view?"rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground":
     "rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-secondary hover:bg-surface-hover"}>
    {ADMIN_SECTION_LABELS[section]}</Link>)}
  </nav>
  {overview?<div className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {([
     ["Registered citizens",overview.citizens,"citizens"],
     ["Unexpired login sessions",overview.liveSessions,"security"],
     ["Workspaces",overview.workspaces,"workspaces"],
     ["Active admin staff",overview.staff,"staff"],
     ["Audit events",overview.events,"activity"],
     ["Pending invitations",overview.pendingInvites,"staff"],
    ] as const).map(([label,value,destination])=>{
     const inside=<><p className="text-sm text-secondary">{label}</p><p className="mt-4 text-3xl font-bold">{value.toLocaleString()}</p>
      <p className="mt-2 text-xs text-muted">{sections.includes(destination)?"View details →":"Summary"}</p></>;
     return sections.includes(destination)?
      <Link key={label} href={href(destination)} className="rounded-2xl border border-border bg-surface p-5 transition hover:border-accent/60 hover:bg-surface-hover">{inside}</Link>:
      <div key={label} className="rounded-2xl border border-border bg-surface p-5">{inside}</div>;
    })}
   </div>
   <h2 className="pt-3 text-lg font-bold text-foreground">Community, civilization & gaming</h2>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {([
     ["New citizens · last 24 hours",overview.registrations24h],
     ["District club messages",overview.clubMessages],
     ["District assembly proposals",overview.districtProposals],
     ["Development cases",overview.developmentCases],
     ["Daily challenge plays",overview.challengeAttempts],
     ["Social messages",overview.socialMessages],
     ["Simulation runs",overview.simulationRuns],
     ["Marketplace listings",overview.marketListings],
    ] as const).map(([label,value])=><div key={label} className="rounded-2xl border border-border bg-surface p-5">
     <p className="text-sm text-secondary">{label}</p><p className="mt-3 text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
    </div>)}
   </div>
   <p className="rounded-2xl border border-border bg-surface p-5 text-sm leading-6 text-secondary">
    These are live database counts, not simulated statistics. Unexpired sessions do not necessarily indicate live presence.
    The activity log covers actions already instrumented by the app, not passive page views or every individual message.
   </p>
  </div>:null}
  {monitoring?<AdminMonitoringPanel data={monitoring}/>:null}
  {logs?<section className="space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><div>
    <h2 className="text-xl font-bold">{view==="activity"?"Platform activity":view==="security"?"Security events":"Civilization events"}</h2>
    <p className="text-sm text-secondary">{total.toLocaleString()} recorded events. Newest first.</p></div>
    {view==="activity"?<Link href={"/api/admin/activity/export?filter="+encodeURIComponent(filter)+"&window="+encodeURIComponent(window)}
     className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold">
     <Download className="size-4"/> Export CSV (up to 5,000 events)</Link>:null}
   </div>
   <form method="get" action="/admin" className="flex flex-wrap items-end gap-2">
    <input type="hidden" name="view" value={view}/>
    {view==="activity"?<label className="space-y-1 text-xs font-semibold text-secondary">Event category
     <select name="filter" defaultValue={filter} className="block rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground">
      {ADMIN_EVENT_FILTERS.filter(option=>option==="all"||option==="community"||option==="content"||
       (option==="security"&&sections.includes("security"))||
       (option==="staff"&&sections.includes("staff"))||
       (option==="civilization"&&sections.includes("civilization"))).map(option=><option value={option} key={option}>{option==="all"?"All events":option}</option>)}
     </select></label>:null}
    <label className="space-y-1 text-xs font-semibold text-secondary">Time range
     <select name="window" defaultValue={window} className="block rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground">
      {ADMIN_AUDIT_WINDOWS.map(option=><option value={option} key={option}>
       {option==="all"?"All recorded history":option==="24h"?"Last 24 hours":option==="7d"?"Last 7 days":"Last 30 days"}
      </option>)}
     </select></label>
    <button type="submit" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">Apply filters</button>
    <Link href={href(view)} className="rounded-lg border border-border px-4 py-2.5 text-sm">Reset</Link>
   </form>
   <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
    <table className="w-full min-w-[650px] text-left text-sm">
     <thead className="border-b border-border text-xs uppercase text-muted"><tr>
      <th className="p-4">Time UTC</th><th className="p-4">Action</th><th className="p-4">Actor</th><th className="p-4">Workspace</th>
     </tr></thead>
     <tbody className="divide-y divide-border">
      {logs.rows.map(row=><tr key={row.id}>
       <td className="whitespace-nowrap p-4 text-secondary">{new Date(row.createdAt).toISOString().replace("T"," ").slice(0,19)}</td>
       <td className="p-4 font-mono text-xs font-semibold">{row.action}</td>
       <td className="p-4 text-secondary">{row.actor?.displayName??"System"}</td>
       <td className="p-4 text-secondary">{row.workspace?.name??"Global"}</td>
      </tr>)}
      {!logs.rows.length?<tr><td className="p-7 text-center text-secondary" colSpan={4}>No events recorded in this category.</td></tr>:null}
     </tbody>
    </table>
   </div>
  </section>:null}
  {people?<section className="space-y-4">
   <h2 className="text-xl font-bold">Citizen directory <span className="text-sm font-normal text-secondary">({total.toLocaleString()})</span></h2>
   <form method="get" action="/admin" className="flex flex-wrap gap-2">
    <input type="hidden" name="view" value="citizens"/>
    <input type="search" name="q" defaultValue={people.query} maxLength={80} placeholder="Search names or emails"
     className="min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm"/>
    <button type="submit" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">Search</button>
    <Link href={href("citizens")} className="rounded-lg border border-border px-4 py-2.5 text-sm">Clear</Link>
   </form>
   <div className="overflow-x-auto rounded-2xl border border-border bg-surface"><table className="w-full min-w-[610px] text-left text-sm">
    <thead className="border-b border-border text-xs uppercase text-muted"><tr>
     <th className="p-4">Account</th><th className="p-4">Email verified</th><th className="p-4">Workspaces</th><th className="p-4">Registered</th>
    </tr></thead><tbody className="divide-y divide-border">
     {people.rows.map(row=><tr key={row.id}>
      <td className="p-4"><p className="font-semibold">{row.displayName}</p><p className="text-xs text-secondary">{row.email}</p></td>
      <td className="p-4">{row.emailVerifiedAt?"Yes":"No"}</td><td className="p-4">{row._count.memberships}</td>
      <td className="p-4">{new Date(row.createdAt).toLocaleDateString()}</td>
     </tr>)}
     {!people.rows.length?<tr><td colSpan={4} className="p-7 text-center text-secondary">No matching accounts.</td></tr>:null}
    </tbody></table></div>
   <p className="text-xs text-muted">Citizen information is private and only visible to authorized staff.</p>
  </section>:null}
  {organizations?<section className="space-y-4">
   <h2 className="text-xl font-bold">Workspace registry <span className="text-sm font-normal text-secondary">({total.toLocaleString()})</span></h2>
   <div className="overflow-x-auto rounded-2xl border border-border bg-surface"><table className="w-full min-w-[570px] text-left text-sm">
    <thead className="border-b border-border text-xs uppercase text-muted"><tr>
     <th className="p-4">Workspace</th><th className="p-4">Owner</th><th className="p-4">Members</th><th className="p-4">Created</th>
    </tr></thead><tbody className="divide-y divide-border">
    {organizations.rows.map(row=><tr key={row.id}>
     <td className="p-4"><p className="font-semibold">{row.name}</p><p className="text-xs text-muted">{row.slug}</p></td>
     <td className="p-4"><p>{row.owner.displayName}</p><p className="text-xs text-secondary">{row.owner.email}</p></td>
     <td className="p-4">{row._count.members}</td><td className="p-4">{new Date(row.createdAt).toLocaleDateString()}</td>
    </tr>)}
    {!organizations.rows.length?<tr><td colSpan={4} className="p-7 text-center text-secondary">No workspaces.</td></tr>:null}
    </tbody></table></div>
  </section>:null}
  {team?<AdminStaffPanel staff={team.staff} invitations={team.invitations} actorRole={staff.role} currentUserId={user.id}/>:null}
  {paged?<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
   <p className="text-xs text-muted">Showing {total===0?0:activePage*perPage+1}–{Math.min((activePage+1)*perPage,total)} of {total}</p>
   <div className="flex gap-2">
    {activePage>0?<Link href={href(view,activePage-1,filter,q,window)}
     className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"><ArrowLeft className="size-4"/> Previous</Link>:null}
    {(activePage+1)*perPage<total?<Link href={href(view,activePage+1,filter,q,window)}
     className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">Next <ArrowRight className="size-4"/></Link>:null}
   </div>
  </div>:null}
  <footer className="border-t border-border py-4 text-xs text-muted">Platform access is separately authorized and revalidated for every restricted server request.</footer>
 </main>;
}
