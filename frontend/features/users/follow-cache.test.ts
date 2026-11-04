import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { invalidateFollowDependentQueries } from "./follow-cache.ts";

test("following invalidates cached feed, profile posts, and user suggestions", async () => {
  const client = new QueryClient();
  client.setQueryData(["posts", "feed"], { items: ["old-feed"] });
  client.setQueryData(["posts", "user", "alice", "posts"], {
    items: ["public-only"],
  });
  client.setQueryData(["users", "suggestions", "viewer"], ["alice"]);

  await invalidateFollowDependentQueries(client);

  assert.equal(client.getQueryState(["posts", "feed"])?.isInvalidated, true);
  assert.equal(
    client.getQueryState(["posts", "user", "alice", "posts"])?.isInvalidated,
    true,
  );
  assert.equal(
    client.getQueryState(["users", "suggestions", "viewer"])?.isInvalidated,
    true,
  );
});
