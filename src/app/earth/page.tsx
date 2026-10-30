import { redirect } from "next/navigation";
/** Retain the legacy URL but replace the public real-Earth map with the fictional SIMVERSE atlas. */
export default function EarthPage() { redirect("/planet"); }
