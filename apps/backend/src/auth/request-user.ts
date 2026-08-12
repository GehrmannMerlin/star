import type { FastifyRequest } from "fastify";

export const TRUSTED_USER_HEADER = "x-ifc-user-id";

export class UnauthenticatedError extends Error {}

export function requireRequestUserId(req: FastifyRequest): string {
  const raw = req.headers[TRUSTED_USER_HEADER];
  if (typeof raw !== "string") throw new UnauthenticatedError("missing trusted user");

  const value = raw.trim();
  if (!value || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new UnauthenticatedError("invalid trusted user");
  }
  return value;
}
