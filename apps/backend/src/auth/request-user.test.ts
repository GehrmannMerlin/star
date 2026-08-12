import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { requireRequestUserId, UnauthenticatedError } from "./request-user.js";

function requestWithHeader(value?: string | string[]): FastifyRequest {
  return {
    headers: value === undefined ? {} : { "x-ifc-user-id": value },
  } as FastifyRequest;
}

describe("requireRequestUserId", () => {
  it.each([
    ["a missing trusted header", undefined],
    ["a repeated trusted header", ["user-a", "user-b"]],
    ["an empty trusted header", ""],
    ["a whitespace-only trusted header", "   "],
    ["a trusted header longer than 128 characters", "a".repeat(129)],
    ["a trusted header containing a control character", "user\u007fname"],
  ])("rejects %s", (_name, value) => {
    expect(() => requireRequestUserId(requestWithHeader(value))).toThrow(UnauthenticatedError);
  });

  it("returns the trimmed trusted user ID as a string", () => {
    expect(requireRequestUserId(requestWithHeader(" 42 "))).toBe("42");
  });
});
