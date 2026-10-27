'use client';

import { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/api-error';
import type { ActivePostItem, PostVisibility } from '@/types/api';
import { postsApi } from '../api';

export function EditPostModal({ post, onClose }: { post: ActivePostItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(post.content ?? '');
  const [visibility, setVisibility] = useState<PostVisibility>(post.visibility);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = content.length <= 2000 && (Boolean(content.trim()) || post.media.length > 0 || Boolean(post.repostOfId));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await postsApi.updatePost(post.id, {
        content: content.trim(),
        ...(post.parentId ? {} : { visibility }),
      });
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể cập nhật bài viết.'));
    } finally {
      setIsSaving(false);
    }
  };

  return <Modal isOpen onClose={onClose} title="Chỉnh sửa bài viết">
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-[13px] font-semibold text-[#4a4860]">Nội dung
        <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} maxLength={2200} className="mt-2 w-full rounded-[16px] border border-[#efedf7] bg-[#f4f2fa] p-3 text-[14px] outline-none focus:border-[#7b78ff]" />
      </label>
      <p className={`text-right text-[12px] ${content.length > 2000 ? 'text-red-600' : 'text-[#8e8ca3]'}`}>{content.length}/2000</p>
      {!post.parentId && <label className="block text-[13px] font-semibold text-[#4a4860]">Ai có thể xem
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as PostVisibility)} className="mt-2 w-full rounded-[16px] border border-[#efedf7] bg-[#f4f2fa] p-3 text-[14px]">
          <option value="PUBLIC">Mọi người</option>
          <option value="FOLLOWERS">Người theo dõi</option>
          <option value="PRIVATE">Chỉ mình tôi</option>
        </select>
      </label>}
      {error && <p role="alert" className="text-[13px] text-red-600">{error}</p>}
      <div className="flex justify-end"><Button type="submit" isLoading={isSaving} disabled={!canSave || isSaving}>Lưu thay đổi</Button></div>
    </form>
  </Modal>;
}
