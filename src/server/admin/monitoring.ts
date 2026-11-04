import {prisma} from "@/server/db/client";
import {requireAdminAccess} from "./access";

/** Aggregated, content-free operational metrics, scoped to the overview permission. */
export async function getAdminMonitoring(now:Date=new Date()) {
 await requireAdminAccess("overview");
 const midnight=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 const dayMs=86_400_000;
 const recent=new Date(now.getTime()-dayMs);
 const days=Array.from({length:7},(_,i)=>{
  const start=new Date(midnight-(6-i)*dayMs);
  const end=new Date(start.getTime()+dayMs);
  return {start,end};
 });
 const [daily,openClubReports,openAssemblyReports,pendingProposals,rejectedAdminCodes24h,factorDisabled24h]=await Promise.all([
  Promise.all(days.map(async ({start,end})=>{
   const where={createdAt:{gte:start,lt:end}};
   const [events,registrations,clubPosts,challengePlays]=await Promise.all([
    prisma.auditLog.count({where}),
    prisma.user.count({where}),
    prisma.districtClubMessage.count({where}),
    prisma.civilizationChallengeAttempt.count({where}),
   ]);
   return {day:start.toISOString().slice(0,10),events,registrations,clubPosts,challengePlays};
  })),
  prisma.districtClubReport.count({where:{status:"OPEN"}}),
  prisma.districtAssemblyReport.count({where:{status:"OPEN"}}),
  prisma.districtAssemblyProposal.count({where:{status:"PENDING_MODERATION"}}),
  prisma.auditLog.count({where:{action:"platform_admin.code_rejected",createdAt:{gte:recent,lte:now}}}),
  prisma.auditLog.count({where:{action:"account.two_factor_disabled",createdAt:{gte:recent,lte:now}}}),
 ]);
 return {
  generatedAt:now.toISOString(),timezone:"UTC" as const,daily,
  queue:{openClubReports,openAssemblyReports,pendingProposals},
  security:{rejectedAdminCodes24h,factorDisabled24h},
 };
}
export type AdminMonitoring=Awaited<ReturnType<typeof getAdminMonitoring>>;
