import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toContainsPattern } from './search.js';

test('search treats LIKE wildcard characters as literal user input', () => {
  assert.equal(toContainsPattern('100%_done'), '%100\\%\\_done%');
  assert.equal(toContainsPattern('a\\b'), '%a\\\\b%');
});
