import {z} from "zod";
import {AuthorizationError,ConflictError,NotFoundError,ValidationError} from "@/lib/errors";
import {prisma} from "@/server/db/client";
import {requireMembership} from "./workspace-service";
import {recordAudit} from "./audit-service";
export const PROJECT_RESPONSIBILITIES=["LEAD","CONTRIBUTOR","REVIEWER","OBSERVER"] as const;
const assignSchema=z.object({
 membershipId:z.string().min(1).max(100),
 responsibility:z.enum(PROJECT_RESPONSIBILITIES),
 notes:z.string().trim().max(500).default(""),
}).strict();
const editSchema=assignSchema.pick({responsibility:true,notes:true}).partial().strict();
async function authorize(userId:string,workspaceId:string,projectId:string,write=false){
 await requireMembership(userId,workspaceId,write?"workspace.members.manage":"project.view");
 const project=await prisma.project.findFirst({where:{id:projectId,workspaceId},select:{id:true,name:true}});
 if(!project)throw new NotFoundError("Project not found in this workspace.");
 return project;
}
export async function listProjectAssignments(userId:string,workspaceId:string,projectId:string){
 await authorize(userId,workspaceId,projectId);
 return prisma.projectAssignment.findMany({where:{projectId},
  include:{membership:{select:{id:true,userId:true,role:true,user:{select:{displayName:true,email:true,avatarUrl:true}}}}},
  orderBy:{createdAt:"asc"},take:100});
}
export async function assignProjectMember(userId:string,workspaceId:string,projectId:string,input:unknown){
 await authorize(userId,workspaceId,projectId,true);
 const parsed=assignSchema.safeParse(input);
 if(!parsed.success)throw new ValidationError("Choose a teammate, responsibility and optional note.");
 const candidate=await prisma.workspaceMember.findFirst({where:{id:parsed.data.membershipId,workspaceId}});
 if(!candidate)throw new NotFoundError("Member not found in this workspace.");
 if(await prisma.projectAssignment.count({where:{projectId}})>=100)throw new ConflictError("This project has reached 100 assignments.");
 const exists=await prisma.projectAssignment.findUnique({where:{projectId_membershipId:{projectId,membershipId:candidate.id}}});
 if(exists)throw new ConflictError("This teammate is already assigned to the project.");
 const row=await prisma.projectAssignment.create({data:{projectId,membershipId:candidate.id,responsibility:parsed.data.responsibility,notes:parsed.data.notes}});
 await recordAudit({action:"project.assignment_created",actorUserId:userId,workspaceId,entityType:"ProjectAssignment",entityId:row.id,metadata:{projectId}});
 return row;
}
export async function updateProjectAssignment(userId:string,workspaceId:string,projectId:string,assignmentId:string,input:unknown){
 await authorize(userId,workspaceId,projectId,true);
 const parsed=editSchema.safeParse(input);
 if(!parsed.success || Object.keys(parsed.data).length===0)throw new ValidationError("Choose a project responsibility or note.");
 const updated=await prisma.projectAssignment.updateMany({where:{id:assignmentId,projectId},data:parsed.data});
 if(!updated.count)throw new NotFoundError("Assignment not found.");
 await recordAudit({action:"project.assignment_updated",actorUserId:userId,workspaceId,entityType:"ProjectAssignment",entityId:assignmentId,metadata:{projectId}});
 return {id:assignmentId};
}
export async function removeProjectAssignment(userId:string,workspaceId:string,projectId:string,assignmentId:string){
 await authorize(userId,workspaceId,projectId,true);
 const removed=await prisma.projectAssignment.deleteMany({where:{id:assignmentId,projectId}});
 if(!removed.count)throw new NotFoundError("Assignment not found.");
 await recordAudit({action:"project.assignment_removed",actorUserId:userId,workspaceId,entityType:"ProjectAssignment",entityId:assignmentId,metadata:{projectId}});
}
