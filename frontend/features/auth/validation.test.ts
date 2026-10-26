import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeOtp, validateNewPassword } from './validation.ts';

test('normalizeOtp removes non-digits and limits the code to six digits', () => {
  assert.equal(normalizeOtp(' 12a3-4567 '), '123456');
});

test('validateNewPassword requires upper, lower, and numeric characters', () => {
  assert.equal(validateNewPassword('abcdefgh'), 'Mật khẩu cần có chữ hoa, chữ thường và chữ số.');
  assert.equal(validateNewPassword('Abcdefg1'), null);
});

test('validateNewPassword rejects passwords shorter than eight characters', () => {
  assert.equal(validateNewPassword('Abc123'), 'Mật khẩu phải có ít nhất 8 ký tự.');
});
