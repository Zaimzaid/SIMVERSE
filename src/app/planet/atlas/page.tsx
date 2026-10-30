import type { Metadata } from "next";
import { FictionalWorldMap } from "@/components/planet/fictional-world-map";
export const metadata: Metadata = { title: "SIMVERSE Country & District Atlas" };
export default function PlanetAtlasPage() { return <FictionalWorldMap />; }
