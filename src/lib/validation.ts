import { z } from "zod";

/**
 * Universal UUID schema matching any 36-character hexadecimal UUID (8-4-4-4-12 hex chars).
 * Unlike Zod's default uuid() which strictly enforces RFC 4122 variant bits ([89abAB]),
 * this schema accepts all valid PostgreSQL UUIDs without throwing false-positive validation errors.
 */
export const zUuid = z
  .string()
  .trim()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid UUID"
  );

export const zOptionalUuid = zUuid.optional().or(z.literal(""));
