"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loginSchema } from "@/lib/validation";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthCard, FormError } from "./auth-card";

export function LoginForm({ next, earthIntent }: { next?: string; earthIntent?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    const { data, error } = await apiFetch<{twoFactorRequired?:boolean;challenge?:string}>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (error) {
      setSubmitting(false);
      if (error.details?.length) setErrors(fieldErrorsFrom(error));
      else setFormError(error.message);
      return;
    }

    if(data?.twoFactorRequired && data.challenge){setChallenge(data.challenge);setPassword("");setSubmitting(false);return;}
    const target = earthIntent
      ? `/earth/restore?intent=${encodeURIComponent(earthIntent)}`
      : next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/dashboard";
    router.replace(target);
    router.refresh();
  }

  async function verifySecondFactor(e:React.FormEvent){
    e.preventDefault();setSubmitting(true);setFormError(null);
    const {error}=await apiFetch("/api/auth/verify-2fa",{method:"POST",body:JSON.stringify({challenge,code})});
    setSubmitting(false);
    if(error){setFormError(error.message);return;}
    const target=earthIntent?`/earth/restore?intent=${encodeURIComponent(earthIntent)}`:next&&next.startsWith("/")&&!next.startsWith("//")?next:"/dashboard";
    router.replace(target);router.refresh();
  }
  return (
    <AuthCard
      title="Welcome back"
      subtitle={challenge?"Enter your authenticator or recovery code.":"Log in to continue to your workspace."}
      footer={
        <>
          New to SIMVERSE?{" "}
          <Link
            href={earthIntent ? `/register?earthIntent=${encodeURIComponent(earthIntent)}` : "/register"}
            className="font-medium text-accent hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <FormError message={formError} />
      {challenge ? <form onSubmit={verifySecondFactor} className="space-y-4">
        <Field label="Authenticator or recovery code" htmlFor="two-factor-code">
         <Input id="two-factor-code" autoFocus required autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code or recovery code"/>
        </Field>
        <Button loading={submitting} className="w-full" type="submit">Verify and log in</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={()=>{setChallenge("");setCode("");setFormError(null);}}>Back to password</Button>
       </form> : <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            autoFocus
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
        </Field>

        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? "Logging in…" : "Log in"}
          {!submitting ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>}
    </AuthCard>
  );
}
