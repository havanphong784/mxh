import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "@js-temporal/polyfill";
import { createOrmTestClient } from "../testing/orm-test-client.js";
import { UsersRepository } from "./users.repository.js";

for (const resetPassword of [false, true]) {
  test(`${resetPassword ? "password reset" : "token reuse detection"} revokes all user sessions with a bulk update`, async () => {
    const revokedUsers: unknown[] = [];
    const { prisma, plans } = createOrmTestClient({
      query: () => [{ id: "otp", email: "user@example.test" }],
      execute: (plan) => {
        if (plan.ast.kind === "update" && plan.ast.table.name === "session") {
          revokedUsers.push(plan.params[1]);
          return 3;
        }
        return 1;
      },
    });
    const repository = new UsersRepository(prisma);
    if (resetPassword) {
      await repository.resetPasswordAndRevokeSessions(
        "user@example.test",
        "otp",
        "user-id",
        "new-hash",
      );
    } else {
      await repository.revokeSessionsForUser("user-id");
    }
    const updates = plans.filter(
      (plan) => plan.ast.kind === "update" && plan.ast.table.name === "session",
    );
    assert.equal(updates.length, 1);
    assert.match(JSON.stringify(updates[0].ast), /"column":"userId"/);
    assert.ok(updates[0].params.includes("user-id"));
    assert.equal(
      plans.filter(
        (plan) =>
          plan.ast.kind === "select" &&
          plan.ast.from?.kind === "table-source" &&
          plan.ast.from.name === "session",
      ).length,
      0,
      "Bulk revocation must not select one session identity before updating",
    );
    assert.equal(revokedUsers.length, 1);
  });
}

for (const method of ["listFollowers", "listFollowing"] as const) {
  test(`${method} compiles a service cursor using the actual follow column`, async () => {
    const { prisma, plans } = createOrmTestClient();
    const repository = new UsersRepository(prisma);
    const createdAt = Temporal.Instant.from("2026-11-25T12:00:00.123456Z");
    assert.deepEqual(
      await repository[method]("owner", {
        limit: 21,
        cursor: { createdAt, id: "last-user" },
      }),
      [],
    );
    assert.equal(plans.length, 1);
    assert.ok(plans[0].params.includes("last-user"));
    const column = method === "listFollowers" ? "followerId" : "followingId";
    assert.match(JSON.stringify(plans[0].ast), new RegExp(`"column":"${column}"`));
  });
}
