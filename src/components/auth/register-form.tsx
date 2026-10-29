"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { registerSchema } from "@/lib/validation";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthCard, FormError } from "./auth-card";

const initial = {
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function RegisterForm({ earthIntent, next }: { earthIntent?: string; next?: string }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function field(key: keyof typeof initial) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    const { error } = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(values),
    });

    if (error) {
      setSubmitting(false);
      if (error.details?.length) setErrors(fieldErrorsFrom(error));
      else setFormError(error.message);
      return;
    }

    router.replace(
      earthIntent
        ? `/earth/restore?intent=${encodeURIComponent(earthIntent)}`
        : next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
    );
    router.refresh();
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building your simulation universe."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={earthIntent ? `/login?earthIntent=${encodeURIComponent(earthIntent)}` : next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="font-medium text-accent hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <FormError message={formError} />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Display name" htmlFor="displayName" error={errors.displayName}>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="name"
            placeholder="Alex Chen"
            value={values.displayName}
            onChange={field("displayName")}
            invalid={Boolean(errors.displayName)}
            autoFocus
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={field("email")}
            invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={values.password}
            onChange={field("password")}
            invalid={Boolean(errors.password)}
          />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword}
        >
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={values.confirmPassword}
            onChange={field("confirmPassword")}
            invalid={Boolean(errors.confirmPassword)}
          />
        </Field>

        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? "Creating account…" : "Create account"}
          {!submitting ? <ArrowRight className="size-4" /> : null}
        </Button>
      </form>
    </AuthCard>
  );
}
