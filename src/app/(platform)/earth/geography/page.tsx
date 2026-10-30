import { redirect } from "next/navigation";
/** The previous authenticated real-Earth explorer is superseded by the fictional SIMVERSE map. */
export default function EarthGeographyPage() { redirect("/planet"); }
