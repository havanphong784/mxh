import assert from 'node:assert/strict';
import test from 'node:test';

import { getApiErrorMessage } from './api-error.ts';

test('returns a NestJS string response message', () => {
  const error = { response: { data: { message: 'Không tìm thấy bài viết' } } };

  assert.equal(getApiErrorMessage(error, 'Có lỗi xảy ra'), 'Không tìm thấy bài viết');
});

test('joins NestJS validation messages into one readable sentence', () => {
  const error = {
    response: {
      data: { message: ['Email không hợp lệ', 'Mật khẩu phải có ít nhất 8 ký tự'] },
    },
  };

  assert.equal(
    getApiErrorMessage(error, 'Có lỗi xảy ra'),
    'Email không hợp lệ. Mật khẩu phải có ít nhất 8 ký tự',
  );
});

test('uses the supplied fallback for non-API errors', () => {
  assert.equal(getApiErrorMessage(new Error('network down'), 'Không thể kết nối'), 'Không thể kết nối');
});

test('reads validation details from the backend errors field', () => {
  const error = {
    response: {
      data: { message: 'Dữ liệu không hợp lệ', errors: ['Tên không được để trống', 'Email không hợp lệ'] },
    },
  };

  assert.equal(
    getApiErrorMessage(error, 'Có lỗi xảy ra'),
    'Tên không được để trống. Email không hợp lệ',
  );
});
