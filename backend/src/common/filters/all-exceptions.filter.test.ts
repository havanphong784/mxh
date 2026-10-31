import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter.js";

function filterResponse(error: Error, path: string) {
  let body: Record<string, unknown> | undefined;
  const reply = {
    header() { return reply; },
    status() { return reply; },
    send(value: Record<string, unknown>) { body = value; },
  };
  const request = { id: "request-1", headers: {}, method: "GET", url: path };
  const host = { switchToHttp() { return { getResponse: () => reply, getRequest: () => request }; } };
  new AllExceptionsFilter().catch(error, host as never);
  return body;
}

test("generic Nest error labels do not replace machine-readable codes", () => {
  assert.equal(filterResponse(new UnauthorizedException("Missing token"), "/api/v1/posts/feed")?.code, "AUTH_UNAUTHORIZED");
});

test("missing user resources receive USER_NOT_FOUND", () => {
  assert.equal(filterResponse(new NotFoundException("Missing user"), "/api/v1/users/alice")?.code, "USER_NOT_FOUND");
});

test("forbidden post actions receive POST_FORBIDDEN_ACTION", () => {
  assert.equal(filterResponse(new ForbiddenException("Not your post"), "/api/v1/posts/post-1")?.code, "POST_FORBIDDEN_ACTION");
});
