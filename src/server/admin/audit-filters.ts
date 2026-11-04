import type { Prisma } from "@prisma/client";

/** Action families must match the actual names emitted by recordAudit. */
export const ADMIN_EVENT_FILTERS = ["all","security","community","civilization","staff","content"] as const;
export type AdminEventFilter = (typeof ADMIN_EVENT_FILTERS)[number];
export const ADMIN_AUDIT_WINDOWS = ["24h","7d","30d","all"] as const;
export type AdminAuditWindow = (typeof ADMIN_AUDIT_WINDOWS)[number];

export function parseAdminEventFilter(value:string|undefined):AdminEventFilter {
 return ADMIN_EVENT_FILTERS.includes(value as AdminEventFilter) ? value as AdminEventFilter : "all";
}
export function parseAdminAuditWindow(value:string|undefined):AdminAuditWindow {
 return ADMIN_AUDIT_WINDOWS.includes(value as AdminAuditWindow) ? value as AdminAuditWindow : "7d";
}

const actionPrefixes:Record<AdminEventFilter,readonly string[]> = {
 all:[],
 security:["account.","auth.","platform_admin.code_","platform_admin.stepup_","platform_admin.access_",
  "user.logged_in","user.logged_out","user.registered"],
 community:["social.","club.","assembly.","district.club.","message."],
 civilization:["user.founding_","user.player_identity_","development.","founding.","civilization.","district.",
  "land.","vascoin.","planet.","earth.","player.governance.","player.document.","player.travel."],
 staff:["platform_admin.","workspace.member_","workspace.invitation_","workspace.members_",
  "workspace.created","workspace.updated"],
 content:["entity.","simulation.","simulation_run.","project.","world.","asset.","media.","tournament.",
  "experience.","player.work.","player.economy."],
};

/** Narrow by both action family and date. The 7-day default bounds routine queries. */
export function adminAuditWhere(filter:AdminEventFilter,window:AdminAuditWindow,now=new Date()):Prisma.AuditLogWhereInput {
 const clauses:Prisma.AuditLogWhereInput[]=[];
 if(filter!=="all") clauses.push({OR:actionPrefixes[filter].map(prefix=>({action:{startsWith:prefix}}))});
 const span:Record<Exclude<AdminAuditWindow,"all">,number>={
  "24h":24*60*60_000,"7d":7*24*60*60_000,"30d":30*24*60*60_000,
 };
 if(window!=="all")clauses.push({createdAt:{gte:new Date(now.getTime()-span[window]),lte:now}});
 if(!clauses.length)return {};
 return clauses.length===1?clauses[0]!:{AND:clauses};
}
