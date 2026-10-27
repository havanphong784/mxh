import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTimeAgo } from './utils.ts';

const now = new Date(2026, 5, 15, 12, 0, 0);

test('shows relative Vietnamese time until seven full days have passed', () => {
  assert.equal(formatTimeAgo(new Date(now.getTime() - 30_000), now), 'Vừa xong');
  assert.equal(formatTimeAgo(new Date(now.getTime() - 59 * 60_000), now), '59 phút trước');
  assert.equal(formatTimeAgo(new Date(now.getTime() - 60 * 60_000), now), '1 giờ trước');
  assert.equal(formatTimeAgo(new Date(now.getTime() - 23 * 3_600_000), now), '23 giờ trước');
  assert.equal(formatTimeAgo(new Date(now.getTime() - 24 * 3_600_000), now), '1 ngày trước');
  assert.equal(formatTimeAgo(new Date(now.getTime() - 6 * 86_400_000), now), '6 ngày trước');
});

test('shows full local date and time from seven days onward', () => {
  assert.equal(formatTimeAgo(new Date(2026, 5, 8, 12, 0, 0), now), '08/06/2026 12:00');
  assert.equal(formatTimeAgo(new Date(2026, 5, 1, 9, 5, 0), now), '01/06/2026 09:05');
});

test('handles future or invalid timestamps without a negative relative time', () => {
  assert.equal(formatTimeAgo(new Date(now.getTime() + 30_000), now), 'Vừa xong');
  assert.equal(formatTimeAgo('not-a-date', now), '—');
});
