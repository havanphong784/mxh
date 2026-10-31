"use client";

import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useMediaUpload } from "@/features/media/hooks/useMediaUpload";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAuthStore } from "@/stores/authStore";
import type { UploadedMedia, UserProfile } from "@/types/api";
import { usersApi } from "../api";

export function EditProfileModal({
  profile,
  isOpen,
  onClose,
}: {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { upload, isUploading } = useMediaUpload();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatar, setAvatar] = useState<UploadedMedia | null>(null);
  const [banner, setBanner] = useState<UploadedMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pick = async (
    file: File | undefined,
    folder: "avatars" | "banners",
  ) => {
    if (!file) return;
    try {
      const result = await upload(file, folder);
      if (folder === "avatars") setAvatar(result);
      else setBanner(result);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Không thể tải ảnh lên."));
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await usersApi.updateMe({
        displayName,
        bio: bio || null,
        ...(avatar
          ? { avatarUrl: avatar.url, avatarPublicId: avatar.publicId }
          : {}),
        ...(banner
          ? { bannerUrl: banner.url, bannerPublicId: banner.publicId }
          : {}),
      });
      await queryClient.invalidateQueries({
        queryKey: ["users", "profile", profile.username],
      });
      const currentUser = useAuthStore.getState().user;
      const currentToken = useAuthStore.getState().accessToken;
      if (currentUser && currentToken) {
        useAuthStore.getState().setAuth(
          {
            ...currentUser,
            displayName,
            bio: bio || null,
            ...(avatar ? { avatarUrl: avatar.url } : {}),
          },
          currentToken,
        );
      }
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Không thể cập nhật hồ sơ."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa hồ sơ">
      <form onSubmit={submit} className="profile-form space-y-4">
        {error && (
          <p className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-[13px] text-red-600">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="cursor-pointer rounded-[16px] border border-dashed border-[#efedf7] p-3 text-center text-[12px] font-semibold hover:bg-[#f4f2fa]">
            Ảnh đại diện
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => pick(event.target.files?.[0], "avatars")}
            />
          </label>
          <label className="cursor-pointer rounded-[16px] border border-dashed border-[#efedf7] p-3 text-center text-[12px] font-semibold hover:bg-[#f4f2fa]">
            Ảnh bìa
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => pick(event.target.files?.[0], "banners")}
            />
          </label>
        </div>
        <label className="block text-[12px] font-semibold">
          Tên hiển thị
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={1}
            maxLength={50}
            required
            className="mt-1 w-full rounded-[16px] border border-[#efedf7] px-3 py-2 text-[14px] outline-none focus:border-[#7b78ff]"
          />
        </label>
        <label className="block text-[12px] font-semibold">
          Tiểu sử
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={250}
            rows={4}
            className="mt-1 w-full resize-none rounded-[16px] border border-[#efedf7] px-3 py-2 text-[14px] outline-none focus:border-[#7b78ff]"
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#8e8ca3]">{bio.length}/250</span>
          <Button type="submit" isLoading={isSaving || isUploading}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
