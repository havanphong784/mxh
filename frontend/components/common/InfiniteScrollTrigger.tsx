'use client';

import { useEffect, useRef } from 'react';

interface InfiniteScrollTriggerProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError?: boolean;
  fetchNextPage: () => unknown;
  loadingMessage?: string;
  endMessage?: string;
}

export function InfiniteScrollTrigger({ hasNextPage, isFetchingNextPage, isFetchNextPageError = false, fetchNextPage, loadingMessage = 'Đang tải thêm…', endMessage }: InfiniteScrollTriggerProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isFetchNextPageError || !sentinelRef.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) fetchNextPage();
    }, { rootMargin: '300px 0px', threshold: 0 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  if (!hasNextPage && !endMessage) return null;
  return <div ref={sentinelRef} className="py-5 text-center text-[12px] text-[#8e8ca3]" aria-live="polite">
    {isFetchNextPageError ? <button type="button" onClick={() => fetchNextPage()} className="rounded-full bg-[#eeedff] px-4 py-2 font-bold text-[#6965e8]">Thử tải lại</button> : isFetchingNextPage ? loadingMessage : hasNextPage ? '' : endMessage}
  </div>;
}
