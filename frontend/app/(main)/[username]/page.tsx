"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProfile } from "@/features/users/hooks/useProfile";
import { usersApi } from "@/features/users/api";
import { ProfileHeader } from "@/features/users/components/ProfileHeader";
import { EditProfileModal } from "@/features/users/components/EditProfileModal";
import { usePostList } from "@/features/posts/hooks/usePostList";
import { usePostInteractions } from "@/features/posts/hooks/usePostInteractions";
import { PostList } from "@/components/common/PostList";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { EmptyState } from "@/components/ui/EmptyState";
import { PostFeedSkeleton, PostSkeleton } from "@/components/ui/PostSkeleton";
import { useAuthStore } from "@/stores/authStore";

export default function ProfilePage() {
  const username = useParams<{ username: string }>().username;
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<"posts" | "replies">("posts");
  const [editing, setEditing] = useState(false);
  const profile = useProfile(username);
  const list = usePostList(["user", username, tab], (cursor) =>
    tab === "posts"
      ? usersApi.getPosts(username, cursor)
      : usersApi.getReplies(username, cursor),
  );
  const actions = usePostInteractions();

  if (profile.isError)
    return (
      <EmptyState
        title="Không tìm thấy người dùng"
        description="Tài khoản này không tồn tại hoặc không còn hoạt động."
        href="/explore"
        action="Khám phá cộng đồng"
      />
    );
  if (!profile.data)
    return (
      <div className="feed-stack">
        <PostSkeleton />
      </div>
    );
  const isOwner = currentUser?.id === profile.data.id;
  const posts = list.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="feed-stack">
      <ProfileHeader
        profile={profile.data}
        isOwner={isOwner}
        onEdit={() => setEditing(true)}
        onFollow={() =>
          currentUser ? profile.toggleFollow() : router.push("/login")
        }
        isFollowPending={profile.isFollowPending}
      />
      <div className="flex gap-2 rounded-[20px] bg-white p-1.5 shadow-[0_12px_32px_-4px_rgba(123,120,255,.08)]">
        {(["posts", "replies"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`flex-1 rounded-[15px] py-2.5 text-[12px] font-bold transition-colors ${tab === item ? "bg-[#eeedff] text-[#6965e8]" : "text-[#8e8ca3] hover:bg-[#f4f2fa]"}`}
          >
            {item === "posts" ? "Bài viết" : "Phản hồi"}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <PostFeedSkeleton count={2} />
      ) : list.isError && posts.length === 0 && !list.hasNextPage ? (
        <EmptyState
          title="Không thể tải nội dung"
          description="Đã có lỗi kết nối. Vui lòng tải lại trang."
        />
      ) : (
        <>
          {posts.length > 0 ? (
            <PostList
              posts={posts}
              currentUserId={currentUser?.id}
              onLike={actions.toggleLike}
              onRepost={actions.toggleRepost}
              onBookmark={actions.toggleBookmark}
              onDelete={actions.deletePost}
            />
          ) : (
            !list.hasNextPage && (
              <EmptyState
                title={
                  tab === "posts" ? "Chưa có bài viết" : "Chưa có phản hồi"
                }
                description="Nội dung mới sẽ xuất hiện ở đây."
              />
            )
          )}
          <InfiniteScrollTrigger
            hasNextPage={Boolean(list.hasNextPage)}
            isFetchingNextPage={list.isFetchingNextPage}
            isFetchNextPageError={list.isFetchNextPageError}
            fetchNextPage={list.fetchNextPage}
          />
        </>
      )}
      {isOwner && (
        <EditProfileModal
          profile={profile.data}
          isOpen={editing}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
