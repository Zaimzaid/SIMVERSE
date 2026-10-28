import { z } from "zod";

/**
 * In-world SIMVERSE-only careers and starter points (SVC).
 * Values are a small, fixed pilot policy, NOT wages or monetary assets.
 * The selected profession is permanent in this pilot so players cannot
 * repeatedly switch professions to mint onboarding grants.
 */
export const SIMVERSE_PROFESSIONS = [
  { code: "AGRICULTURE", label: "Agriculture & Food Systems", startingCredits: 850,
    intro: "Grow food, learn farming systems and build virtual agri-enterprises.",
    training: "Basic simulated crop and livestock safety orientation" },
  { code: "ENGINEERING", label: "Engineering & Technology", startingCredits: 800,
    intro: "Design infrastructure, automation and virtual machines.",
    training: "Engineering safety and design fundamentals" },
  { code: "HEALTH", label: "Health & Care", startingCredits: 700,
    intro: "Participate in fictional community care and health research.",
    training: "Safety orientation; regulated medical actions will need separately approved licenses" },
  { code: "EDUCATION", label: "Education & Research", startingCredits: 650,
    intro: "Develop learning experiences and research collaborations.",
    training: "Foundations of teaching and digital safety" },
  { code: "COMMERCE", label: "Commerce & Entrepreneurship", startingCredits: 750,
    intro: "Plan shops, businesses and creative marketplaces.",
    training: "Introduction to bookkeeping and ethical trading" },
  { code: "CREATIVE", label: "Creative Arts & Media", startingCredits: 600,
    intro: "Create media, experiences and entertainment in SIMVERSE.",
    training: "Creator conduct and intellectual property basics" },
  { code: "TRANSPORT", label: "Transport & Logistics", startingCredits: 650,
    intro: "Manage virtual transport, delivery and logistics services.",
    training: "Virtual vehicle and logistics safety orientation" },
  { code: "CIVIC", label: "Civic & Public Services", startingCredits: 500,
    intro: "Engage in community service and fictional civic work.",
    training: "Governance and community conduct basics; does not grant government authority" },
] as const;

export const BUSINESS_SECTORS = [
  "AGRICULTURE", "ENGINEERING", "HEALTH", "EDUCATION", "COMMERCE",
  "CREATIVE", "TRANSPORT", "CIVIC",
] as const;
export const selectedProfessionSchema = z.strictObject({
  professionCode: z.enum(SIMVERSE_PROFESSIONS.map((profession) => profession.code) as [
    typeof SIMVERSE_PROFESSIONS[number]["code"],
    ...Array<typeof SIMVERSE_PROFESSIONS[number]["code"]>,
  ]),
});
export const businessDraftSchema = z.strictObject({
  name: z.string().trim().min(3).max(64)
    .regex(/^[A-Za-z][A-Za-z0-9 &.'-]*$/, "Use a business name beginning with a letter."),
  sector: z.enum(BUSINESS_SECTORS),
  description: z.string().trim().max(500).default(""),
});

export function getProfession(code: string) {
  return SIMVERSE_PROFESSIONS.find((p) => p.code === code) ?? null;
}

export function normalizedBusinessName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export const ECONOMY_NOTICE =
  "SIMVERSE Credits (SVC) are fictional, nontransferable pilot game points with no cash value. " +
  "This system cannot accept deposits, charge money, issue professional licenses or grant a real business registration.";
