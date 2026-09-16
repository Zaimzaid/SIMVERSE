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

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    const { error } = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (error) {
      setSubmitting(false);
      if (error.details?.length) setErrors(fieldErrorsFrom(error));
      else setFormError(error.message);
      return;
    }

    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    router.replace(target);
    router.refresh();
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to continue to your workspace."
      footer={
        <>
          New to SIMVERSE?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <FormError message={formError} />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
      </form>
    </AuthCard>
  );
}
