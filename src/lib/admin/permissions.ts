/** Separate platform-wide staff permissions. Workspace ownership never grants these. */
export const ADMIN_SECTIONS = ["overview","activity","citizens","workspaces","civilization","security","staff"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
export const ADMIN_ROLES = ["OWNER","ADMIN","MODERATOR","ANALYST","VIEWER"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const INVITABLE_ADMIN_ROLES = ["ADMIN","MODERATOR","ANALYST","VIEWER"] as const;
export type InvitableAdminRole = (typeof INVITABLE_ADMIN_ROLES)[number];
export const ADMIN_SECTION_LABELS: Record<AdminSection,string> = {
 overview:"Overview",activity:"Activity",citizens:"Citizens",workspaces:"Workspaces",
 civilization:"Civilization",security:"Security",staff:"Staff & invitations",
};
const grants: Record<AdminRole, readonly AdminSection[]> = {
 OWNER: ADMIN_SECTIONS,
 ADMIN: ADMIN_SECTIONS,
 MODERATOR: ["overview","activity","citizens","civilization"],
 ANALYST: ["overview","activity","workspaces","civilization"],
 VIEWER: ["overview"],
};
export function isAdminRole(role: string): role is AdminRole {
 return (ADMIN_ROLES as readonly string[]).includes(role);
}
export function isInvitableAdminRole(role: string): role is InvitableAdminRole {
 return (INVITABLE_ADMIN_ROLES as readonly string[]).includes(role);
}
export function allowedAdminSections(role: AdminRole, denied: readonly string[] = []): AdminSection[] {
 return grants[role].filter(section=>role==="OWNER"||!denied.includes(section));
}
export function readDeniedAdminSections(raw: string | null | undefined): AdminSection[] {
 try{
  const parsed:unknown=JSON.parse(raw??"[]");
  return Array.isArray(parsed) ? parsed.filter((x):x is AdminSection => typeof x==="string" && (ADMIN_SECTIONS as readonly string[]).includes(x)) : [];
 }catch{return [];}
}
export function validateAdminRestrictions(role: AdminRole, denied: readonly string[]): boolean {
 if(role==="OWNER") return denied.length===0;
 return denied.every(x=>grants[role].includes(x as AdminSection));
}
export function mayManageAdminRole(actor:AdminRole,target:AdminRole):boolean {
 return actor==="OWNER" && target!=="OWNER" || actor==="ADMIN" && !["OWNER","ADMIN"].includes(target);
}
