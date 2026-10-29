import assert from "node:assert/strict";
import { test } from "node:test";
import { AccessSessionService } from "./access-session.service.js";

test("revoked access sessions expose AUTH_SESSION_REVOKED", async () => {
  const jwt = { async verifyAsync() { return { sub: "user-1", email: "user@example.test", username: "user", sessionId: "session-1" }; } };
  const session = { userId: "user-1", isRevoked: true, expiresAt: new Date(Date.now() + 60_000), user: { isActive: true, isEmailVerified: true } };
  const prisma = { client: { orm: { public: { Session: { where() { return { include() { return this; }, async first() { return session; } }; } } } } } };
  const service = new AccessSessionService(jwt as any, prisma as any);

  await assert.rejects(service.verifyAccessToken("valid-token"), (error: any) => {
    assert.equal(error.getResponse().code, "AUTH_SESSION_REVOKED");
    return true;
  });
});

test("expired access tokens expose AUTH_TOKEN_EXPIRED", async () => {
  const jwt = { async verifyAsync() { const error = new Error("jwt expired"); error.name = "TokenExpiredError"; throw error; } };
  const service = new AccessSessionService(jwt as any, {} as any);

  await assert.rejects(service.verifyAccessToken("expired-token"), (error: any) => {
    assert.equal(error.getResponse().code, "AUTH_TOKEN_EXPIRED");
    return true;
  });
});
