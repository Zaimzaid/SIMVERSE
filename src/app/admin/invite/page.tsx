import Link from "next/link";
import type {Metadata} from "next";
import {getSessionUser} from "@/server/auth/session";
import {previewAdminInvitation} from "@/server/admin/service";
import {AdminInviteAccept} from "@/components/admin/admin-invite-accept";
export const metadata:Metadata={title:"Accept a KAVANDRO admin invitation",robots:{index:false,follow:false}};
export default async function AdminInvitePage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const {token=""}=await searchParams;
 const invitation=await previewAdminInvitation(token);
 const user=await getSessionUser();
 const next="/admin/invite?token="+encodeURIComponent(token);
 return <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
  <section className="w-full space-y-5 rounded-3xl border border-border bg-surface p-7 shadow-lg">
   <p className="text-xs font-bold uppercase tracking-widest text-accent">KAVANDRO administration</p>
   <h1 className="text-2xl font-bold text-foreground">Private staff invitation</h1>
   {!invitation?<p role="alert" className="text-secondary">This invitation has expired, has already been accepted or has been revoked. Request a new link from your administrator.</p>:<>
    <p className="text-sm text-secondary">You have been invited as <strong>{invitation.role}</strong>. This invitation is restricted to <strong>{invitation.email}</strong>.</p>
    <p className="text-xs text-muted">Invitation expires {new Date(invitation.expiresAt).toUTCString()} if not accepted. Once accepted, the link expires immediately.</p>
    {!user?<div className="space-y-3">
     <Link href={"/login?next="+encodeURIComponent(next)} className="block rounded-xl bg-accent px-5 py-3 text-center font-semibold text-accent-foreground">Log in with invited account</Link>
     <Link href={"/register?next="+encodeURIComponent(next)} className="block text-center text-sm text-accent underline">Create the invited account</Link>
    </div>:user.email.toLowerCase()!==invitation.email.toLowerCase()?
     <p role="alert" className="text-sm text-danger">You are signed in as {user.email}. Log out and use the exact invited email address to accept this invitation.</p>:
     <AdminInviteAccept token={token} email={user.email} enabled={Boolean(user.twoFactorEnabledAt)}/>}
   </>}
   <Link href="/dashboard" className="block text-sm text-accent underline">Back to KAVANDRO</Link>
  </section>
 </main>;
}
