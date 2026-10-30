import type { Metadata } from "next";
import { SignaturePlanetExplorer } from "@/components/planet/signature-planet-explorer";
export const metadata: Metadata = { title: "SIMVERSE Orbital World Map", description: "Explore the fictional SIMVERSE planet and its ten founding countries." };
export default function PlanetPage() { return <main className="min-h-dvh bg-[#020812] p-0 sm:p-5"><SignaturePlanetExplorer /></main>; }
