import assert from "node:assert/strict";
import { test } from "node:test";
import { validateMessageImages } from "../src/inbox/media.ts";
import { messageDraft } from "../src/inbox/model.ts";

const image = (size: number, type = "image/png") => ({ size, type }) as File;
test("message image selection enforces count, real byte boundary and supported types", () => {
  assert.equal(validateMessageImages([image(10485760)], 4), null);
  assert.ok(validateMessageImages([image(1), image(1)], 4));
  assert.ok(validateMessageImages([image(10485761)], 0));
  assert.ok(validateMessageImages([image(1, "image/svg+xml")], 0));
});
test("image-only draft retries preserve identity, while caption or ordered media changes create a new intent", () => {
  let serial = 0;
  const id = () => String(++serial);
  const media = [
    { publicId: "a", version: 1, signature: "signed" },
    { publicId: "b", version: 1, signature: "signed" },
  ];
  const first = messageDraft("", null, id, media);
  assert.ok(first);
  assert.equal(messageDraft("", first, id, media), first);
  assert.notEqual(
    messageDraft("", first, id, [...media].reverse())?.clientMessageId,
    first.clientMessageId,
  );
  assert.notEqual(
    messageDraft("caption", first, id, media)?.clientMessageId,
    first.clientMessageId,
  );
  assert.equal(messageDraft("", null, id, []), null);
});
