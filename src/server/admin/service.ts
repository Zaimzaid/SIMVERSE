import {createHash,randomBytes} from "node:crypto";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {AuthorizationError,ConflictError,NotFoundError,ValidationError} from "@/lib/errors";
import {env} from "@/lib/env";
import {isAdminRole,mayManageAdminRole,readDeniedAdminSections,validateAdminRestrictions,type AdminRole,type AdminSection} from "@/lib/admin/permissions";
import {prisma} from "@/server/db/client";
import {requireAdminAccess,verifyAdminTotp} from "./access";
import {scopedAdminAuditWhere,type AdminEventFilter,type AdminAuditWindow} from "./audit-filters";
export {ADMIN_EVENT_FILTERS,ADMIN_AUDIT_WINDOWS,parseAdminEventFilter,parseAdminAuditWindow} from "./audit-filters";

const ROLE_INPUT=z.enum(["ADMIN","MODERATOR","ANALYST","VIEWER"]);
const invitedInput=z.object({
 email:z.email().trim().toLowerCase(),role:ROLE_INPUT,
 deniedSections:z.array(z.string()).max(7).default([]),
}).strict();
const editInput=z.object({
 role:ROLE_INPUT.optional(),active:z.boolean().optional(),
 deniedSections:z.array(z.string()).max(7).optional(),
}).strict().refine(value=>Object.keys(value).length>0);
const SHA=(token:string)=>createHash("sha256").update(token).digest("hex");
const INVITE_LIFETIME_MS=24*60*60_000;
export function isPlatformAdminInviteToken(token:string):boolean {return /^[A-Za-z0-9_-]{40,60}$/.test(token);}
function deniedForRole(role:AdminRole,denied:readonly string[]):string {
 const unique=[...new Set(denied)];
 if(!validateAdminRestrictions(role,unique))throw new ValidationError("Restrictions must be sections granted to the selected role.");
 return JSON.stringify(unique);
}
async function adminAudit(actorUserId:string,action:string,metadata:Record<string,unknown>={}){
 await prisma.auditLog.create({data:{actorUserId,action,entityType:"PlatformAdmin",metadata:JSON.stringify(metadata)}});
}
async function sendAdminInvitation(email:string,link:string):Promise<boolean>{
 const key=process.env.RESEND_API_KEY,from=process.env.SIMVERSE_INVITE_FROM;
 if(!key||!from)return false;
 try{
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
   body:JSON.stringify({from,to:[email],subject:"Invitation to the KAVANDRO administration team",
    text:`You have been invited to the KAVANDRO administrative dashboard. The link is valid for 24 hours before acceptance and can be used only once. Log in with this email address and verify a code from your authenticator app: ${link}\nIf you did not expect this invitation, ignore this email.`}),
   signal:AbortSignal.timeout(8000),
  });
  return response.ok;
 }catch{return false;}
}
export async function getPlatformOverview(){
 await requireAdminAccess("overview");
 const now=new Date();
 const [citizens,liveSessions,workspaces,staff,events,pendingInvites,registrations24h,clubMessages,districtProposals,developmentCases,challengeAttempts,socialMessages,simulationRuns,marketListings]=await Promise.all([
  prisma.user.count(),prisma.session.count({where:{expiresAt:{gt:now}}}),
  prisma.workspace.count(),prisma.platformAdmin.count({where:{active:true}}),
  prisma.auditLog.count(),prisma.platformAdminInvitation.count({where:{expiresAt:{gt:now}}}),
  prisma.user.count({where:{createdAt:{gte:new Date(Date.now()-24*60*60_000)}}}),
  prisma.districtClubMessage.count(),prisma.districtAssemblyProposal.count(),
  prisma.foundingDevelopmentCase.count(),prisma.civilizationChallengeAttempt.count(),
  prisma.socialMessage.count(),prisma.simulationRun.count(),prisma.marketListing.count(),
 ]);
 return {citizens,liveSessions,workspaces,staff,events,pendingInvites,registrations24h,clubMessages,districtProposals,developmentCases,challengeAttempts,socialMessages,simulationRuns,marketListings};
}
function safePage(page:number){return Number.isInteger(page)&&page>=0?Math.min(page,1000):0;}
export async function listAdminAudit(filter:AdminEventFilter,page=0,section:AdminSection="activity",window:AdminAuditWindow="7d"){
 const access=await requireAdminAccess(section);
 const safe=safePage(page),where=scopedAdminAuditWhere(filter,window,access.sections),limit=30;
 const [total,rows]=await Promise.all([
  prisma.auditLog.count({where}),
  prisma.auditLog.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],skip:safe*limit,take:limit,
   select:{id:true,action:true,createdAt:true,entityType:true,
    actor:{select:{displayName:true,email:true}},workspace:{select:{name:true}}},
  }),
 ]);
 return {total,page:safe,limit,rows:rows.map(row=>({
  ...row,createdAt:row.createdAt.toISOString(),
  actor:access.sections.includes("citizens")?row.actor:(row.actor?{displayName:"Restricted",email:""}:null),
  workspace:access.sections.includes("workspaces")?row.workspace:(row.workspace?{name:"Restricted"}:null),
 }))};
}
export async function exportAdminAudit(filter:AdminEventFilter,window:AdminAuditWindow="7d"){
 const access=await requireAdminAccess("activity");
 const rows=await prisma.auditLog.findMany({
  where:scopedAdminAuditWhere(filter,window,access.sections),orderBy:{createdAt:"desc"},take:5000,
  select:{id:true,action:true,createdAt:true,entityType:true,entityId:true,
   actor:{select:{displayName:true,email:true}},workspace:{select:{name:true}}},
 });
 return rows.map(row=>({
  ...row,
  actor:access.sections.includes("citizens")?row.actor:(row.actor?{displayName:"Restricted",email:""}:null),
  workspace:access.sections.includes("workspaces")?row.workspace:(row.workspace?{name:"Restricted"}:null),
  entityId:access.sections.includes("citizens")?row.entityId:null,
 }));
}
export async function listAdminCitizens(query:string,page=0){
 await requireAdminAccess("citizens");
 const q=query.trim().slice(0,80);
 const safe=safePage(page),limit=30;
 const where:Prisma.UserWhereInput=q?{OR:[
  {displayName:{contains:q}},
  {email:{contains:q}},
 ]}:{};
 const [total,rows]=await Promise.all([
  prisma.user.count({where}),
  prisma.user.findMany({
   where,
   orderBy:{createdAt:"desc"},
   skip:safe*limit,
   take:limit,
   select:{
    id:true,
    email:true,
    displayName:true,
    emailVerifiedAt:true,
    createdAt:true,
    _count:{select:{memberships:true,sessions:true}},
   },
  }),
 ]);
 return {total,page:safe,limit,query:q,rows:rows.map(row=>({
  ...row,
  createdAt:row.createdAt.toISOString(),
  emailVerifiedAt:row.emailVerifiedAt?.toISOString()??null,
 }))};
}
export async function listAdminWorkspaces(page=0){
 const access=await requireAdminAccess("workspaces");
 const safe=safePage(page),limit=30;
 const [total,rows]=await Promise.all([
  prisma.workspace.count(),
  prisma.workspace.findMany({
   orderBy:{createdAt:"desc"},
   skip:safe*limit,
   take:limit,
   select:{
    id:true,
    name:true,
    slug:true,
    createdAt:true,
    owner:{select:{displayName:true,email:true}},
    _count:{select:{members:true}},
   },
  }),
 ]);
 return {total,page:safe,limit,rows:rows.map(row=>({
  ...row,createdAt:row.createdAt.toISOString(),
  owner:access.sections.includes("citizens")?row.owner:{displayName:"Restricted",email:""},
 }))};
}
export async function listAdminStaff(){
 await requireAdminAccess("staff");
 const [staff,invitations]=await Promise.all([
  prisma.platformAdmin.findMany({orderBy:{createdAt:"asc"},include:{user:{select:{displayName:true,email:true}}}}),
  prisma.platformAdminInvitation.findMany({where:{expiresAt:{gt:new Date()}},orderBy:{createdAt:"desc"},take:100,
   select:{id:true,email:true,role:true,deniedSections:true,expiresAt:true}}),
 ]);
 return {
  staff:staff.map(row=>({id:row.id,userId:row.userId,name:row.user.displayName,email:row.user.email,
   role:row.role,active:row.active,deniedSections:readDeniedAdminSections(row.deniedSections),
   createdAt:row.createdAt.toISOString()})),
  invitations:invitations.map(row=>({...row,deniedSections:readDeniedAdminSections(row.deniedSections),
   expiresAt:row.expiresAt.toISOString()})),
 };
}
export async function createAdminInvitation(input:unknown){
 const actor=await requireAdminAccess("staff");
 const parsed=invitedInput.safeParse(input);
 if(!parsed.success)throw new ValidationError("Enter an email, valid staff role and permitted sections.");
 const {email,role,deniedSections}=parsed.data;
 if(actor.role!=="OWNER" && role==="ADMIN")throw new AuthorizationError("Only the platform owner can invite an administrator.");
 const restrictions=deniedForRole(role,deniedSections);
 const existing=await prisma.user.findUnique({where:{email},select:{id:true}});
 if(existing && await prisma.platformAdmin.count({where:{userId:existing.id,active:true}}))
  throw new ConflictError("This account already has platform administration access.");
 const outstanding=await prisma.platformAdminInvitation.count({where:{expiresAt:{gt:new Date()}}});
 if(outstanding>=100)throw new ConflictError("Too many pending invitations. Revoke old invitations first.");
 const already=await prisma.platformAdminInvitation.findFirst({where:{email,expiresAt:{gt:new Date()}}});
 if(already)throw new ConflictError("An active invitation already exists for this email.");
 const token=randomBytes(32).toString("base64url");
 const invitation=await prisma.platformAdminInvitation.create({data:{
  email,role,deniedSections:restrictions,tokenHash:SHA(token),
  invitedByUserId:actor.user.id,expiresAt:new Date(Date.now()+INVITE_LIFETIME_MS),
 }});
 const link=env.APP_URL.replace(/\/$/,"")+"/admin/invite?token="+encodeURIComponent(token);
 const emailSent=await sendAdminInvitation(email,link);
 await adminAudit(actor.user.id,"platform_admin.invitation_created",{inviteId:invitation.id,email,role,emailSent});
 return {id:invitation.id,inviteUrl:link,emailSent,expiresAt:invitation.expiresAt.toISOString()};
}
export async function revokeAdminInvitation(inviteId:string){
 const actor=await requireAdminAccess("staff");
 const result=await prisma.platformAdminInvitation.deleteMany({where:{id:inviteId}});
 if(!result.count)throw new NotFoundError("Invitation already expired or revoked.");
 await adminAudit(actor.user.id,"platform_admin.invitation_revoked",{inviteId});
 return {ok:true};
}
export async function previewAdminInvitation(token:string){
 if(!isPlatformAdminInviteToken(token))return null;
 const invite=await prisma.platformAdminInvitation.findUnique({where:{tokenHash:SHA(token)},
  select:{email:true,role:true,expiresAt:true}});
 if(!invite||invite.expiresAt<=new Date())return null;
 return {email:invite.email,role:invite.role,expiresAt:invite.expiresAt.toISOString()};
}
export async function acceptAdminInvitation(userId:string,token:string,code:unknown){
 if(!isPlatformAdminInviteToken(token))throw new NotFoundError("Invitation is invalid, used or expired.");
 const invite=await prisma.platformAdminInvitation.findUnique({where:{tokenHash:SHA(token)}});
 if(!invite||invite.expiresAt<=new Date()||!isAdminRole(invite.role)||invite.role==="OWNER")
  throw new NotFoundError("Invitation is invalid, used or expired.");
 const user=await prisma.user.findUnique({where:{id:userId},select:{email:true}});
 if(!user||user.email.toLowerCase()!==invite.email.toLowerCase())
  throw new AuthorizationError("Sign in using the exact email address that was invited.");
 await verifyAdminTotp(userId,code);
 const existing=await prisma.platformAdmin.findUnique({where:{userId}});
 if(existing?.active)throw new ConflictError("This account already belongs to the admin team.");
 if(existing?.role==="OWNER")throw new AuthorizationError("A platform owner's role cannot be changed through an invitation.");
 await prisma.$transaction(async tx=>{
  const consumed=await tx.platformAdminInvitation.deleteMany({where:{id:invite.id,expiresAt:{gt:new Date()}}});
  if(!consumed.count)throw new ConflictError("This invitation has already been used or expired.");
  await tx.platformAdmin.upsert({where:{userId},create:{
   userId,role:invite.role,deniedSections:invite.deniedSections,active:true,
  },update:{role:invite.role,deniedSections:invite.deniedSections,active:true}});
  await tx.auditLog.create({data:{actorUserId:userId,action:"platform_admin.invitation_accepted",
   entityType:"PlatformAdmin",metadata:JSON.stringify({inviteId:invite.id,role:invite.role})}});
 });
 return {ok:true};
}
export async function updateAdminStaff(staffId:string,input:unknown){
 const actor=await requireAdminAccess("staff");
 const parsed=editInput.safeParse(input);
 if(!parsed.success)throw new ValidationError("Supply a valid role, status or section restrictions.");
 const target=await prisma.platformAdmin.findUnique({where:{id:staffId}});
 if(!target || !isAdminRole(target.role))throw new NotFoundError("Staff member not found.");
 if(target.userId===actor.user.id)throw new AuthorizationError("You cannot edit your own administrative access.");
 if(!mayManageAdminRole(actor.role,target.role))throw new AuthorizationError("You cannot manage staff at this access level.");
 const role=parsed.data.role??target.role;
 if(role==="ADMIN"&&actor.role!=="OWNER")throw new AuthorizationError("Only the platform owner can grant the administrator role.");
 const denied=parsed.data.deniedSections??readDeniedAdminSections(target.deniedSections);
 const restrictions=deniedForRole(role,denied);
 const updated=await prisma.platformAdmin.update({where:{id:staffId},data:{
  role,deniedSections:restrictions,active:parsed.data.active??target.active,
 }});
 await adminAudit(actor.user.id,"platform_admin.staff_updated",{staffId,fromRole:target.role,
  role:updated.role,active:updated.active,deniedSections:denied});
 return {id:updated.id,role:updated.role,active:updated.active,
  deniedSections:readDeniedAdminSections(updated.deniedSections)};
}
