import assert from "node:assert/strict";
import test from "node:test";

const people = () => import("../src/people/contracts.ts");

function transport(...responses: unknown[]) {
  const calls: { path: string; options: unknown }[] = [];
  async function api<T>(path: string, options?: unknown): Promise<T> {
    calls.push({ path, options });
    assert.ok(responses.length, `Unexpected request to ${path}`);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response as T;
  }
  return { api, calls };
}

test("matches directory deep links and only known profile subpaths", async () => {
  const { parsePeoplePath, profileHref, peopleHref, messageHref } = await people();
  assert.deepEqual(parsePeoplePath("/people?q=%20Lan+Anh%20"), {
    kind: "directory",
    query: "Lan Anh",
  });
  assert.deepEqual(parsePeoplePath("/profile/lan%2Danh/following/"), {
    kind: "following",
    username: "lan-anh",
  });
  assert.deepEqual(parsePeoplePath("/profile/lan/followers"), {
    kind: "followers",
    username: "lan",
  });
  assert.deepEqual(parsePeoplePath("/settings"), { kind: "settings" });
  assert.equal(parsePeoplePath("/profile/%E0%A4%A"), null);
  assert.equal(parsePeoplePath("/profile/lan/replies"), null);
  assert.equal(parsePeoplePath("/profile/lan%2Fanh"), null);
  assert.equal(profileHref("lan-anh", "followers"), "/profile/lan-anh/followers");
  assert.equal(peopleHref("Lan & An"), "/people?q=Lan+%26+An");
  assert.equal(messageHref("user?2"), "/messages?to=user%3F2");
});

test("loads guest and signed-in profiles with the right viewer context", async () => {
  const { createPeopleClient } = await people();
  const { api, calls } = transport({ isFollowing: false }, { isFollowing: true });
  const client = createPeopleClient(api);
  const signal = new AbortController().signal;
  assert.equal((await client.profile("lan", false, signal)).isFollowing, false);
  assert.equal((await client.profile("lan", true, signal)).isFollowing, true);
  assert.deepEqual(calls, [
    { path: "/users/lan", options: { auth: false, signal } },
    { path: "/users/lan", options: { auth: true, signal } },
  ]);
});

test("uses a user ID for authenticated follow and unfollow", async () => {
  const { createPeopleClient, afterFollow } = await people();
  const { api, calls } = transport({ message: "ok" }, undefined);
  const client = createPeopleClient(api);
  const profile = {
    id: "user/7",
    username: "lan",
    displayName: "Lan",
    isFollowing: false,
    followersCount: 4,
    followingCount: 2,
  };
  const followed = afterFollow(profile, await client.setFollowing(profile.id, true));
  assert.equal(followed.isFollowing, true);
  assert.equal(followed.followersCount, 5);
  assert.equal(afterFollow(followed, true).followersCount, 5);
  assert.deepEqual(afterFollow(followed, await client.setFollowing(profile.id, false)), profile);
  assert.deepEqual(calls, [
    { path: "/users/user%2F7/follow", options: { method: "POST", auth: true } },
    {
      path: "/users/user%2F7/follow",
      options: { method: "DELETE", auth: true },
    },
  ]);
});

test("follow state changes invalidate an embedded timeline revision", async () => {
  const { bumpTimelineForFollow } = await people();
  assert.equal(bumpTimelineForFollow(4, false, true), 5);
  assert.equal(bumpTimelineForFollow(4, true, false), 5);
  assert.equal(bumpTimelineForFollow(4, true, true), 4);
});

test("passes opaque cursors unchanged to search and both follow lists", async () => {
  const { createPeopleClient, uniquePeople } = await people();
  const lan = { id: "1", username: "lan", displayName: "Lan" };
  const mai = { id: "2", username: "mai", displayName: "Mai" };
  const { api, calls } = transport(
    { items: [lan], nextCursor: "a/1+=" },
    { items: [lan, mai], nextCursor: null },
    {},
    {},
  );
  const client = createPeopleClient(api);
  const first = await client.search(" Lan & Mai ", null);
  const last = await client.search("Lan & Mai", first.nextCursor);
  assert.deepEqual(uniquePeople(first.items, last.items), [lan, mai]);
  assert.equal(last.nextCursor, null);
  await client.connections("lan", "followers", null);
  await client.connections("lan", "following", "a/1+=");
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      "/users/search?limit=20&q=Lan+%26+Mai",
      "/users/search?limit=20&q=Lan+%26+Mai&cursor=a%2F1%2B%3D",
      "/users/lan/followers?limit=20",
      "/users/lan/following?limit=20&cursor=a%2F1%2B%3D",
    ],
  );
});

test("rejects short or oversized searches without calling the backend", async () => {
  const { createPeopleClient } = await people();
  const { api, calls } = transport();
  const client = createPeopleClient(api);
  await assert.rejects(client.search("  a ", null));
  await assert.rejects(client.search("a".repeat(101), null));
  assert.deepEqual(calls, []);
});

test("requests suggestions with viewer context so the backend can exclude existing follows", async () => {
  const { createPeopleClient } = await people();
  const { api, calls } = transport({ items: [] });
  assert.deepEqual(await createPeopleClient(api).suggestions(true), {
    items: [],
  });
  assert.equal(calls[0].path, "/users/suggestions");
  assert.equal((calls[0].options as { auth: boolean }).auth, true);
});

test("loads private settings and patches changed profile fields with URL and public ID pairs", async () => {
  const { createPeopleClient, profilePatch, updatedViewer } = await people();
  const original = {
    id: "1",
    email: "lan@example.test",
    isEmailVerified: true,
    username: "lan",
    displayName: "Lan",
    bio: "Cũ",
    avatarUrl: "old",
    avatarPublicId: "old-id",
  };
  const banner = {
    url: "https://res.cloudinary.com/demo/image/upload/v7/mxh/1/banners/cat.png",
    publicId: "mxh/1/banners/cat",
  };
  const saved = {
    ...original,
    displayName: "Lan Anh",
    bio: null,
    avatarUrl: null,
    avatarPublicId: null,
    bannerUrl: banner.url,
    bannerPublicId: banner.publicId,
  };
  const { api, calls } = transport(original, saved);
  const client = createPeopleClient(api);
  const loaded = await client.settings();
  assert.deepEqual(
    profilePatch(loaded, { displayName: " Lan ", bio: " Cũ " }, undefined, undefined),
    {},
  );
  const fields = profilePatch(loaded, { displayName: " Lan Anh ", bio: " " }, null, banner);
  const updated = await client.saveProfile(fields);
  assert.deepEqual(calls, [
    { path: "/users/me", options: { auth: true, signal: undefined } },
    {
      path: "/users/me",
      options: {
        auth: true,
        method: "PATCH",
        body: {
          displayName: "Lan Anh",
          bio: null,
          avatarUrl: null,
          avatarPublicId: null,
          bannerUrl: banner.url,
          bannerPublicId: banner.publicId,
        },
      },
    },
  ]);
  assert.deepEqual(updatedViewer({ id: "1", username: "lan", displayName: "Lan" }, updated), {
    id: "1",
    email: "lan@example.test",
    isEmailVerified: true,
    username: "lan",
    displayName: "Lan Anh",
    bio: null,
    avatarUrl: null,
    bannerUrl: banner.url,
  });
});

test("uploads only the signed Cloudinary multipart fields without app credentials", async () => {
  const { createPeopleClient } = await people();
  const signature = {
    signature: "signed",
    timestamp: 17,
    apiKey: "key",
    cloudName: "demo",
    folder: "mxh/1/avatars",
    resourceType: "image",
  };
  const { api, calls } = transport(signature);
  const file = new File(["pixels"], "avatar.png", { type: "image/png" });
  const secureUrl = "https://res.cloudinary.com/demo/image/upload/v7/mxh/1/avatars/cat.png";
  const upload: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.cloudinary.com/v1_1/demo/image/upload");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.method, "POST");
    assert.equal(init.headers, undefined);
    assert.ok(init.body instanceof FormData);
    const { file: sent, ...fields } = Object.fromEntries(init.body);
    assert.deepEqual(fields, {
      folder: signature.folder,
      api_key: "key",
      timestamp: "17",
      signature: "signed",
    });
    assert.ok(sent instanceof File);
    assert.equal(await sent.text(), "pixels");
    return Response.json({
      secure_url: secureUrl,
      public_id: "mxh/1/avatars/cat",
    });
  };
  assert.deepEqual(await createPeopleClient(api, upload).uploadImage("avatars", file), {
    url: secureUrl,
    publicId: "mxh/1/avatars/cat",
  });
  assert.deepEqual(calls, [
    {
      path: "/media/upload-signature?folder=avatars&mediaType=image",
      options: { auth: true },
    },
  ]);
});

test("does not return an image reference when a signed banner upload fails", async () => {
  const { createPeopleClient } = await people();
  const { api, calls } = transport({
    signature: "signed",
    timestamp: 17,
    apiKey: "key",
    cloudName: "demo",
    folder: "mxh/1/banners",
    resourceType: "image",
  });
  const upload: typeof fetch = async () => new Response(null, { status: 403 });
  await assert.rejects(
    createPeopleClient(api, upload).uploadImage(
      "banners",
      new File(["pixels"], "banner.png", { type: "image/png" }),
    ),
  );
  assert.equal(calls[0].path, "/media/upload-signature?folder=banners&mediaType=image");
});

test("keeps passwords byte-for-byte and honors the other-device checkbox", async () => {
  const { createPeopleClient, passwordProblem } = await people();
  const { api, calls } = transport({ message: "ok" });
  assert.ok(passwordProblem("Old1234", "nospecial", "nospecial"));
  assert.ok(passwordProblem("Old1234", "New12345", "New12346"));
  assert.ok(passwordProblem("Same1234", "Same1234", "Same1234"));
  assert.equal(passwordProblem(" old ", "  New12345  ", "  New12345  "), null);
  await createPeopleClient(api).changePassword(" old ", "  New12345  ", false);
  assert.deepEqual(calls, [
    {
      path: "/users/change-password",
      options: {
        auth: true,
        method: "POST",
        body: {
          oldPassword: " old ",
          newPassword: "  New12345  ",
          logoutOtherDevices: false,
        },
      },
    },
  ]);
});

test("clears shell session after cookie logout, not before or on a network failure", async () => {
  const { createPeopleClient } = await people();
  const { api, calls } = transport(new Error("Offline"), { message: "ok" });
  const client = createPeopleClient(api);
  const changes: unknown[] = [];
  const onUser = (user: null) => changes.push(user);
  await assert.rejects(client.logout(onUser), /Offline/);
  assert.deepEqual(changes, []);
  await client.logout(onUser);
  assert.deepEqual(changes, [null]);
  assert.deepEqual(
    calls,
    Array.from({ length: 2 }, () => ({
      path: "/auth/logout",
      options: { auth: false, method: "POST" },
    })),
  );
});

test("does not start a Cloudinary upload if the editor is left while signing", async () => {
  const { createPeopleClient } = await people();
  const controller = new AbortController();
  const api = async <T>(): Promise<T> => {
    controller.abort();
    return {
      signature: "signed",
      timestamp: 17,
      apiKey: "key",
      cloudName: "demo",
      folder: "mxh/1/banners",
      resourceType: "image",
    } as T;
  };
  const upload: typeof fetch = async () =>
    assert.fail("Started Cloudinary upload after cancellation");
  await assert.rejects(
    createPeopleClient(api, upload).uploadImage(
      "banners",
      new File(["pixels"], "banner.png", { type: "image/png" }),
      controller.signal,
    ),
    { name: "AbortError" },
  );
});

test("an unchanged registration-length name does not block a bio edit", async () => {
  const { profilePatch } = await people();
  const displayName = "a".repeat(65);
  const original = {
    id: "1",
    username: "mai",
    displayName,
    bio: null,
  } as Parameters<typeof profilePatch>[0];
  assert.deepEqual(
    profilePatch(original, { displayName, bio: "Hồ sơ mới" }, undefined, undefined),
    { bio: "Hồ sơ mới" },
  );
});
