import type {AdminMonitoring} from "@/server/admin/monitoring";

const series=[
// Deliberately aggregate-only; no private message contents, recipient identities or report bodies.
 {key:"events",title:"Recorded actions",tone:"bg-accent"},
 {key:"registrations",title:"New citizens",tone:"bg-sky-500"},
 {key:"clubPosts",title:"District club posts",tone:"bg-violet-500"},
 {key:"challengePlays",title:"Challenge plays",tone:"bg-emerald-500"},
] as const;

export function AdminMonitoringPanel({data}:{data:AdminMonitoring}){
 return <section className="space-y-4" aria-label="Seven day platform operations">
  <div className="flex flex-wrap items-end justify-between gap-2">
   <div><h2 className="text-lg font-bold">Platform activity trends</h2>
    <p className="text-sm text-secondary">Last seven calendar days · UTC · actual recorded activity</p></div>
   <p className="text-xs text-muted">Updated {new Date(data.generatedAt).toISOString().replace("T"," ").slice(0,16)} UTC</p>
  </div>
  <div className="grid gap-3 md:grid-cols-2">
   {series.map(metric=>{
    const maximum=Math.max(1,...data.daily.map(day=>day[metric.key]));
    const count=data.daily.reduce((sum,day)=>sum+day[metric.key],0);
    return <div key={metric.key} className="rounded-2xl border border-border bg-surface p-5">
     <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-semibold text-secondary">{metric.title}</h3>
      <p className="text-xl font-bold tabular-nums">{count.toLocaleString()} <span className="text-xs font-normal text-muted">7d</span></p>
     </div>
     <div className="mt-4 grid grid-cols-7 gap-2" role="img" aria-label={metric.title+" by UTC day"}>
      {data.daily.map(day=><div key={day.day} className="flex flex-col items-center gap-2">
       <div className="flex h-24 w-full items-end justify-center rounded-md bg-surface-hover/40" title={day.day+": "+day[metric.key].toLocaleString()}>
        <div className={metric.tone+" w-2/3 min-w-1 rounded-t-sm"} style={{height:day[metric.key]?Math.max(5,day[metric.key]/maximum*100)+"%":"0%"}}/>
       </div>
       <span className="text-[10px] text-muted">{day.day.slice(5)}</span>
       <span className="text-[10px] font-semibold tabular-nums">{day[metric.key].toLocaleString()}</span>
      </div>)}
     </div>
    </div>;
   })}
  </div>
  <h2 className="pt-3 text-lg font-bold">Operational review & security signals</h2>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
   {([
    ["Open club reports",data.queue.openClubReports],
    ["Open assembly reports",data.queue.openAssemblyReports],
    ["Proposals awaiting review",data.queue.pendingProposals],
    ["Rejected admin codes · 24h",data.security.rejectedAdminCodes24h],
    ["2FA disabled · 24h",data.security.factorDisabled24h],
   ] as const).map(([label,value])=><div key={label} className="rounded-2xl border border-border bg-surface p-4">
    <p className="text-xs font-semibold text-secondary">{label}</p>
    <p className="mt-3 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
   </div>)}
  </div>
  <p className="text-xs leading-5 text-muted">These numbers are monitoring signals, not confirmed incidents. Review queues do not grant authority to view private reports or moderate content. Activity charts use database counts and contain no message text.</p>
  <h2 className="pt-3 text-lg font-bold">Country & district engagement</h2>
  <div className="grid gap-3 md:grid-cols-2">
   <div className="rounded-2xl border border-border bg-surface p-5">
    <h3 className="font-semibold">Active citizenships by country</h3>
    <p className="mb-4 text-xs text-secondary">Top eight · current approved national citizenships</p>
    <div className="space-y-3">
     {data.regions.topCountries.map(row=><div key={row.countryId} className="flex items-center justify-between gap-4 text-sm">
      <span className="min-w-0 truncate">{row.country}</span><span className="font-bold tabular-nums">{row.citizens.toLocaleString()}</span>
     </div>)}
     {!data.regions.topCountries.length?<p className="text-sm text-muted">No approved citizenships recorded.</p>:null}
    </div>
   </div>
   <div className="rounded-2xl border border-border bg-surface p-5">
    <h3 className="font-semibold">Most active district clubs</h3>
    <p className="mb-4 text-xs text-secondary">Top eight · all-time message counts, excluding message contents</p>
    <div className="space-y-3">
     {data.regions.topDistricts.map(row=><div key={row.districtId} className="flex items-center justify-between gap-4 text-sm">
      <span className="min-w-0 truncate">{row.district} <span className="text-xs text-muted">· {row.country}</span></span>
      <span className="font-bold tabular-nums">{row.messages.toLocaleString()}</span>
     </div>)}
     {!data.regions.topDistricts.length?<p className="text-sm text-muted">No district club messages recorded.</p>:null}
    </div>
   </div>
  </div>
 </section>;
}
