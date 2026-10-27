import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageTitle } from '../components/common/page-title.ts';

test('top bar shows the page title for main and nested routes', () => {
  assert.equal(pageTitle('/feed'), 'Bảng tin');
  assert.equal(pageTitle('/liked'), 'Đã thích');
  assert.equal(pageTitle('/bookmarks'), 'Đã lưu');
  assert.equal(pageTitle('/alice/followers'), 'Người theo dõi');
  assert.equal(pageTitle('/followers'), 'Hồ sơ');
  assert.equal(pageTitle('/post/123'), 'Thảo luận');
});
