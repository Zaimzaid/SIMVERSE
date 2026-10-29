import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { earthRestoreHref, verifyEarthDestinationIntent } from "@/server/earth/destination-intent";
import { getCurrentUser } from "@/server/context";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;
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
  if (user) redirect(earthIntent ? earthRestoreHref(earthIntent) : next ?? "/dashboard");
  return <RegisterForm earthIntent={earthIntent} next={next} />;
}
