import { z } from "zod";

export const VASCOIN_UNIT = "VC" as const;
// Fixed server-side pilot rules; no client may choose minted amounts or kinds.
export const VASCOIN_DAILY_CLAIM = 10;
export const VASCOIN_SUPPLY_CEILING = 1_000_000;
export const VASCOIN_DAILY_CONTRIBUTION_LIMIT = 500;
export const VASCOIN_MAX_CONTRIBUTIONS_PER_DAY = 3;
export const VASCOIN_POLICY_ID = "vascoin-pilot-v1";
export const VASCOIN_ISSUER_ACCOUNT_ID = "vascoin-issuance-v1";

export const vascoinContributionSchema = z.strictObject({
  amount: z.number().int().min(1).max(500),
  requestId: z.string().uuid(),
});

export const vascoinNotice =
  "Vascoin is a nonredeemable SIMVERSE game balance, not cash, cryptocurrency, SVC or GFC. " +
  "District contributions are virtual, not donations or commitments to build. " +
  "Treasury spending and transfers to outside users are unavailable.";
