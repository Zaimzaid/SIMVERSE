import type { Metadata } from "next";
import { SignaturePlanetExplorer } from "@/components/planet/signature-planet-explorer";

export const metadata: Metadata = {
  title: "Signature Orbital Planet | SIMVERSE",
  description: "Explore the new fictional SIMVERSE planet. An empty spherical world ready for original countries and stories.",
  robots: { index: false, follow: false },
};

/**
 * Stage 1 visual proof only. Additive route intentionally does not replace
 * legacy /earth until fictional geography and safe migration are verified.
 */
export default function PlanetPage() {
  return (
    <main className="min-h-dvh bg-[#020812] p-0 sm:p-5">
      <SignaturePlanetExplorer />
    </main>
  );
}
