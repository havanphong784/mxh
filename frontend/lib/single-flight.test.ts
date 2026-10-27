import assert from 'node:assert/strict';
import test from 'node:test';
import { singleFlight } from './single-flight.ts';

test('simultaneous refresh callers share one result, then a later call can refresh again', async () => {
  let calls = 0;
  let finish!: (token: string) => void;
  const refresh = singleFlight(() => {
    calls += 1;
    return new Promise<string>((resolve) => { finish = resolve; });
  });

  const first = refresh();
  const second = refresh();
  assert.equal(calls, 1, 'hai nơi gọi đồng thời chỉ được xoay cookie một lần');

  finish('new-token');
  assert.deepEqual(await Promise.all([first, second]), ['new-token', 'new-token']);

  const third = refresh();
  assert.equal(calls, 2, 'lần refresh sau phải dùng một yêu cầu mới');
  finish('next-token');
  assert.equal(await third, 'next-token');
});

test('failed refresh is not cached for future login attempts', async () => {
  let calls = 0;
  const refresh = singleFlight(async () => {
    calls += 1;
    if (calls === 1) throw new Error('expired');
    return 'new-token';
  });

  await assert.rejects(refresh(), /expired/);
  assert.equal(await refresh(), 'new-token');
  assert.equal(calls, 2);
});
