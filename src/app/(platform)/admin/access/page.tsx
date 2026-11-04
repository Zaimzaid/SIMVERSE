import Link from "next/link";
import {redirect,notFound} from "next/navigation";
import type {Metadata} from "next";
import {ShieldCheck} from "lucide-react";
import {getSessionUser} from "@/server/auth/session";
import {getPlatformStaff,isAdminStepupValid} from "@/server/admin/access";
import {AdminGate} from "@/components/admin/admin-gate";
export const metadata:Metadata={title:"Admin verification | KAVANDRO",robots:{index:false,follow:false}};
export default async function AdminAccessPage(){
 const user=await getSessionUser();
 if(!user)redirect("/login?next="+encodeURIComponent("/admin/access"));
 const staff=await getPlatformStaff(user.id);
 if(!staff?.active)notFound();
 if(user.twoFactorEnabledAt&&await isAdminStepupValid(user.id))redirect("/admin");
 return <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-12">
  <section className="w-full rounded-3xl border border-border bg-surface p-7 shadow-lg">
   <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><ShieldCheck className="size-6"/></div>
   <p className="text-xs font-bold uppercase tracking-widest text-accent">KAVANDRO · Restricted administration</p>
   <h1 className="mt-2 text-2xl font-bold text-foreground">Verify your identity</h1>
   <p className="mt-2 text-sm leading-6 text-secondary">Staff access is separate from ordinary workspaces. Enter the code from the authenticator attached to <strong>{user.email}</strong>.</p>
   {!user.twoFactorEnabledAt?<div className="mt-5 space-y-3">
    <p role="alert" className="text-sm text-danger">Authenticator-based two-factor authentication is required for all platform administrators.</p>
    <Link className="inline-flex rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground" href="/settings">Enable two-factor authentication</Link>
   </div>:<AdminGate/>}
   <Link href="/dashboard" className="mt-6 block text-sm text-accent hover:underline">Return to KAVANDRO</Link>
  </section>
 </div>;
}
