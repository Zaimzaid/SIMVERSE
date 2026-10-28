import type { Metadata } from "next";
import { requirePlatformContext } from "@/server/context";
import { NeighborhoodShowcase } from "@/components/earth/neighborhood-showcase";

export const metadata: Metadata = {
  title: "Marina Junction | SIMVERSE Earth 3D Proof",
  description: "A walkable fictional Lagos-inspired 3D neighborhood visual prototype.",
};

/**
 * Authenticated and standalone: the proof deliberately does not read/write
 * development-zone land inventory, ownership or property transactions.
 */
export default async function EarthNeighborhoodPage() {
  await requirePlatformContext();
  return <NeighborhoodShowcase />;
}
