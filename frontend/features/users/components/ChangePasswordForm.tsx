"use client";

import { FormEvent, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { usersApi } from "@/features/users/api";
import { validateNewPassword } from "@/features/auth/validation";
import { getApiErrorMessage } from "@/lib/api-error";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export function ChangePasswordForm() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Đăng nhập để quản lý bảo mật"
        description="Bạn cần đăng nhập để đổi mật khẩu."
        href="/login"
        action="Đăng nhập"
      />
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);

    const valError = validateNewPassword(newPassword);
    if (valError) {
      setNewPasswordError(valError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await usersApi.changePassword({
        oldPassword,
        newPassword,
        logoutOtherDevices,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(result.data.message);
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể đổi mật khẩu."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="surface-card p-5 sm:p-7">
      <h2 className="text-[18px] font-extrabold">Đổi mật khẩu</h2>
      <p className="mt-2 text-[13px] text-[#6d6a82]">
        Dùng mật khẩu ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-[13px] font-semibold">
          Mật khẩu hiện tại
          <input
            type="password"
            autoComplete="current-password"
            required
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            className="mt-2 block w-full rounded-[16px] border border-[#efedf7] bg-[#f4f2fa] p-3 text-[14px] outline-none focus:border-[#7b78ff]"
          />
        </label>
        <label className="block text-[13px] font-semibold">
          Mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              if (newPasswordError) setNewPasswordError(null);
            }}
            className={`mt-2 block w-full rounded-[16px] border p-3 text-[14px] outline-none transition-colors ${
              newPasswordError
                ? "border-red-400 bg-red-50/40 focus:border-red-500"
                : "border-[#efedf7] bg-[#f4f2fa] focus:border-[#7b78ff]"
            }`}
          />
          {newPasswordError && (
            <p className="mt-1 text-[12px] text-red-500 font-normal">
              {newPasswordError}
            </p>
          )}
        </label>
        <label className="block text-[13px] font-semibold">
          Nhập lại mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (confirmPasswordError) setConfirmPasswordError(null);
            }}
            className={`mt-2 block w-full rounded-[16px] border p-3 text-[14px] outline-none transition-colors ${
              confirmPasswordError
                ? "border-red-400 bg-red-50/40 focus:border-red-500"
                : "border-[#efedf7] bg-[#f4f2fa] focus:border-[#7b78ff]"
            }`}
          />
          {confirmPasswordError && (
            <p className="mt-1 text-[12px] text-red-500 font-normal">
              {confirmPasswordError}
            </p>
          )}
        </label>
        <label className="flex items-center gap-2 text-[13px] text-[#4a4860]">
          <input
            type="checkbox"
            checked={logoutOtherDevices}
            onChange={(event) => setLogoutOtherDevices(event.target.checked)}
          />
          Đăng xuất khỏi các thiết bị khác
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-[13px] text-green-700">
            {message}
          </p>
        )}
        <Button type="submit" isLoading={isSaving} disabled={isSaving}>
          Lưu mật khẩu
        </Button>
      </form>
    </section>
  );
}
