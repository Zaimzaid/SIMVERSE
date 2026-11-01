import { z } from "zod";

/**
 * Independent product vocabulary for the citizenship-interest pilot.
 * Phase 2 geography is paused; these approved names do not imply that any
 * corresponding country has been published or that citizenship was granted.
 * Before a future merge, reconcile this catalog with Phase 2 founding-plan.ts.
 */
export const FOUNDING_NATION_NAMES = [
  { slug: "valdora", name: "Valdora" },
  { slug: "arandia", name: "Arandia" },
  { slug: "novara", name: "Novara" },
  { slug: "dravonia", name: "Dravonia" },
  { slug: "marovia", name: "Marovia" },
  { slug: "solandia", name: "Solandia" },
  { slug: "vestria", name: "Vestria" },
  { slug: "altavia", name: "Altavia" },
  { slug: "eldoria", name: "Eldoria" },
  { slug: "terranova", name: "Terranova" },
] as const;

export const foundingNationSlugs = [
  "valdora", "arandia", "novara", "dravonia", "marovia",
  "solandia", "vestria", "altavia", "eldoria", "terranova",
] as const;

export const PILOT_DISTRICT_INTEREST_KEY = "arandia-proposed-pilot" as const;

/**
 * An INTEREST form, not a citizenship application, residency change or vote.
 * A member of any preferred nationality can be interested in the same pilot.
 */
export const citizenInterestInputSchema = z.strictObject({
  preferredNationSlug: z.enum(foundingNationSlugs).nullable(),
  proposedPilotInterest: z.boolean(),
});

export type CitizenInterestInput = z.infer<typeof citizenInterestInputSchema>;
export const CITIZEN_INTEREST_STATUS = "PREFERENCE_ONLY" as const;

export function foundingNationName(slug: string | null): string | null {
  return FOUNDING_NATION_NAMES.find((nation) => nation.slug === slug)?.name ?? null;
}
