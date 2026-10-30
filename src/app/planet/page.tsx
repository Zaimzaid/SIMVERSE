import type { Metadata } from "next";
import { FictionalWorldMap } from "@/components/planet/fictional-world-map";
export const metadata: Metadata = { title: "SIMVERSE World Map", description: "Explore SIMVERSE's fictional continents, countries, capitals and districts." };
export default function PlanetPage() { return <FictionalWorldMap />; }
