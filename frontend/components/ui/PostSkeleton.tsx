import React from "react";

export function PostSkeleton() {
  return (
    <div
      className="feed-card p-5 animate-pulse space-y-4"
      aria-busy="true"
      aria-label="Đang tải bài viết..."
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-[#e8e6f2]" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-1/3 rounded-full bg-[#e8e6f2]" />
          <div className="h-2.5 w-1/5 rounded-full bg-[#efedf7]" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded-full bg-[#e8e6f2]" />
        <div className="h-3 w-4/5 rounded-full bg-[#e8e6f2]" />
        <div className="h-3 w-2/3 rounded-full bg-[#efedf7]" />
      </div>
      <div className="h-44 w-full rounded-[20px] bg-[#f0effa]" />
      <div className="flex justify-between pt-2">
        <div className="h-7 w-14 rounded-full bg-[#efedf7]" />
        <div className="h-7 w-14 rounded-full bg-[#efedf7]" />
        <div className="h-7 w-14 rounded-full bg-[#efedf7]" />
        <div className="h-7 w-14 rounded-full bg-[#efedf7]" />
      </div>
    </div>
  );
}

export function PostFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="feed-stack">
      {Array.from({ length: count }).map((_, index) => (
        <PostSkeleton key={index} />
      ))}
    </div>
  );
}
