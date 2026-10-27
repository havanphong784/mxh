import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigationState, getBackDestination, transitionNavigation } from './navigation-state.ts';

test('back from a post returns to the in-app list, then stops at the entry page', () => {
  const feed = createNavigationState('/feed');
  const post = transitionNavigation(feed, '/post/123', 'push');
  assert.equal(getBackDestination(post), '/feed');

  const returned = transitionNavigation(post, '/feed', 'pop');
  assert.equal(getBackDestination(returned), null);
});

test('opening a post directly never treats external browser history as in-app history', () => {
  assert.equal(getBackDestination(createNavigationState('/post/123')), null);
});

test('going forward and then opening another route discards the old forward branch', () => {
  const state = transitionNavigation(createNavigationState('/feed'), '/post/123', 'push');
  const back = transitionNavigation(state, '/feed', 'pop');
  const forward = transitionNavigation(back, '/post/123', 'pop');
  assert.equal(getBackDestination(forward), '/feed');

  const branched = transitionNavigation(back, '/explore', 'push');
  assert.equal(getBackDestination(branched), '/feed');
  assert.deepEqual(branched.paths, ['/feed', '/explore']);
});
