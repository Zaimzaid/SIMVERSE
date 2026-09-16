import { z } from "zod";

/**
 * Shared validation schemas. The server layer treats these as authoritative;
 * clients may reuse them for UX but server validation always runs.
 */

const displayName = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(60, "Display name must be at most 60 characters.");

const email = z
  .email("Enter a valid email address.")
  .trim()
  .toLowerCase()
  .max(254, "Email address is too long.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password must be at most 200 characters.")
  .regex(/[A-Za-z]/, "Password must contain at least one letter.")
  .regex(/[0-9]/, "Password must contain at least one number.");

const optionalUrl = z
  .union([z.url("Enter a valid URL."), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

export const registerSchema = z
  .object({
    displayName,
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export const updateProfileSchema = z.object({
  displayName,
  avatarUrl: optionalUrl,
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(60, "Workspace name must be at most 60 characters."),
  logoUrl: optionalUrl,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
