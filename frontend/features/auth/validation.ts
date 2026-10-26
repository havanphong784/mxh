export function normalizeOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Mật khẩu cần có chữ hoa, chữ thường và chữ số.';
  }
  return null;
}
