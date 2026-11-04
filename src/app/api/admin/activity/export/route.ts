import {errorResponse} from "@/server/api/response";
import {exportAdminAudit,parseAdminEventFilter} from "@/server/admin/service";
function csv(value:string|null|undefined):string{
 const source=String(value??"");
 // Prevent spreadsheet formula execution when opening exported data.
 const guarded=/^[\s]*[=+@\-]/.test(source)?"'"+source:source;
 return '"'+guarded.replace(/"/g,'""')+'"';
}
export async function GET(request:Request){
 try{
  const filter=parseAdminEventFilter(new URL(request.url).searchParams.get("filter")??undefined);
  const events=await exportAdminAudit(filter);
  const rows=[
   ["Timestamp (UTC)","Action","Actor","Actor email","Workspace","Entity type","Entity ID"],
   ...events.map(e=>[e.createdAt.toISOString(),e.action,e.actor?.displayName??"System",e.actor?.email??"",
    e.workspace?.name??"",e.entityType??"",e.entityId??""]),
  ];
  const text=rows.map(row=>row.map(csv).join(",")).join("\r\n")+"\r\n";
  const date=new Date().toISOString().slice(0,10);
  return new Response("\uFEFF"+text,{headers:{
   "Content-Type":"text/csv; charset=utf-8",
   "Content-Disposition":`attachment; filename="kavandro-admin-activity-${date}.csv"`,
   "Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff",
  }});
 }catch(error){return errorResponse(error);}
}
