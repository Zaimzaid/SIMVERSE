import { z } from "zod";
import { SIMVERSE_PROFESSIONS } from "./economy";

// All assessments are fictional introductory conduct/safety exercises,
// not professional certifications, clinical authorization, or qualifications.
export const INTRO_QUESTIONS = [
  { id: "conduct", question: "A SIMVERSE colleague shares their login details with you. What should you do?",
    options: ["Use the account to finish their work", "Decline and ask them to use authorized team access", "Post the details publicly"] },
  { id: "safety", question: "Before performing a regulated virtual occupation, which rule applies?",
    options: ["Career choice instantly grants a license", "Claim any profession you prefer", "Follow separate training and permission rules"] },
  { id: "records", question: "Which employment information should you enter?",
    options: ["Accurate records of simulated work", "Invented hours for higher pay", "Other players' private passwords"] },
] as const;
// Server-only answers are deliberately defined outside the public question payload.
export const ORIENTATION_VERSION = 1;
export const orientationInput = z.strictObject({
  answers: z.tuple([z.number().int().min(0).max(2), z.number().int().min(0).max(2),
    z.number().int().min(0).max(2)]),
});
export const businessSubmitInput = z.strictObject({});
export const businessReviewInput = z.strictObject({
  decision: z.enum(["APPROVE", "DENY"]),
  note: z.string().trim().min(10).max(500),
});
export const jobCreateInput = z.strictObject({
  businessId: z.string().cuid(),
  title: z.string().trim().min(5).max(80),
  description: z.string().trim().min(15).max(1000),
  professionCode: z.enum(SIMVERSE_PROFESSIONS.map((p) => p.code) as [
    typeof SIMVERSE_PROFESSIONS[number]["code"],
    ...Array<typeof SIMVERSE_PROFESSIONS[number]["code"]>,
  ]),
});
export const applyJobInput = z.strictObject({
  statement: z.string().trim().min(10).max(500),
});
export const employerDecisionInput = z.strictObject({
  decision: z.enum(["OFFER", "REJECT"]),
});
export const applicantDecisionInput = z.strictObject({
  decision: z.enum(["ACCEPT", "DECLINE"]),
});
export const WORK_NOTICE =
  "SIMVERSE-only training and employment simulation. No real diploma, license, " +
  "legal company registration, salary, professional authority or cash transaction is created.";
