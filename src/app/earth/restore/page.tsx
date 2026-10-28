import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  earthAuthHref,
  verifyEarthDestinationIntent,
} from "@/server/earth/destination-intent";
import { getCurrentUser, getPlatformContext } from "@/server/context";
import { resolveEarthDestinationIntent } from "@/server/services/earth-destination-service";

export const metadata: Metadata = {
  title: "Restoring Earth destination",
  robots: { index: false, follow: false },
};

export default async function EarthRestorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.intent === "string" ? params.intent : "";
  try {
    verifyEarthDestinationIntent(token);
  } catch {
    redirect("/earth?intentStatus=expired");
  }

  const user = await getCurrentUser();
  if (!user) redirect(earthAuthHref("/login", token));
  const context = await getPlatformContext();
  if (!context) redirect("/earth?intentStatus=unavailable");

  let destination = "/earth?intentStatus=unavailable";
  try {
    const resolved = await resolveEarthDestinationIntent(
      context.user.id,
      context.workspace.id,
      token,
    );
    destination = `/earth/geography?place=${encodeURIComponent(resolved.place.id)}&restored=1`;
  } catch {
    // The safe public Earth route explains that the saved destination expired
    // or is no longer authorized without revealing why it failed.
  }
  redirect(destination);
}
