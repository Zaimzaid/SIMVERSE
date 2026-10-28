import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { earthRestoreHref, verifyEarthDestinationIntent } from "@/server/earth/destination-intent";
import { getCurrentUser } from "@/server/context";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const rawIntent = typeof sp.earthIntent === "string" ? sp.earthIntent : undefined;
  let earthIntent: string | undefined;
  if (rawIntent) {
    try {
      verifyEarthDestinationIntent(rawIntent);
      earthIntent = rawIntent;
    } catch {
      earthIntent = undefined;
    }
  }
  const user = await getCurrentUser();
  if (user) redirect(earthIntent ? earthRestoreHref(earthIntent) : "/dashboard");
  return <LoginForm next={next} earthIntent={earthIntent} />;
}
