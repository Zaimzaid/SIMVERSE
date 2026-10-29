import Link from "next/link";
import type {Metadata} from "next";
import {getSessionUser} from "@/server/auth/session";
import {previewWorkspaceInvitation} from "@/server/services/team-service";
import {JoinWorkspace} from "@/components/platform/team/join-workspace";
export const metadata:Metadata={title:"Join a SIMVERSE team"};
export default async function JoinPage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const {token=""}=await searchParams;
 const invitation=await previewWorkspaceInvitation(token);
 const currentUser=await getSessionUser();
 const next="/join?token="+encodeURIComponent(token);
 return <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-16">
 <div className="w-full rounded-2xl border border-border bg-surface p-7 space-y-5">
 <h1 className="text-2xl font-bold text-foreground">Join a SIMVERSE team</h1>
 {!invitation?<p className="text-secondary">This invitation is invalid, expired or already used. Ask the workspace owner for a new invitation.</p>:<>
 <p className="text-secondary">You are invited to <strong>{invitation.workspaceName}</strong> as <strong>{invitation.role.toLowerCase()}</strong>.</p>
 <p className="text-sm text-secondary">Only the account registered with <strong>{invitation.email}</strong> can accept this invitation.</p>
 {currentUser?<JoinWorkspace token={token} currentEmail={currentUser.email} invitedEmail={invitation.email}/>:<div className="space-y-3"><Link className="block rounded-lg bg-accent p-3 text-center font-semibold text-accent-foreground" href={"/login?next="+encodeURIComponent(next)}>Log in to accept</Link><Link className="block text-center text-accent underline" href={"/register?next="+encodeURIComponent(next)}>Create an account</Link></div>}
 </>}
 </div></main>;
}
