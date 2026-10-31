import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthController } from "./auth.controller.js";

test("refresh cookie is signed and read through the verified cookie interface", () => {
  const controller = new AuthController({} as never);
  let options: Record<string, unknown> | undefined;
  const reply = { setCookie(_name: string, _value: string, cookieOptions: Record<string, unknown>) { options = cookieOptions; } };
  (controller as unknown as { setRefreshTokenCookie(reply: object, token: string): void })
    .setRefreshTokenCookie(reply, "refresh-token");
  assert.equal(options?.signed, true);

  const reader = (controller as unknown as { readRefreshTokenCookie(request: object): string | undefined });
  assert.equal(reader.readRefreshTokenCookie({
    cookies: { refreshToken: "signed-value" },
    unsignCookie(value: string) {
      assert.equal(value, "signed-value");
      return { valid: true, value: "refresh-token" };
    },
  }), "refresh-token");
  assert.throws(() => reader.readRefreshTokenCookie({
    cookies: { refreshToken: "tampered" },
    unsignCookie() { return { valid: false, value: null }; },
  }));
});
