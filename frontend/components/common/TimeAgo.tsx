'use client';

import { useEffect, useState } from 'react';
import { formatFullDateTime, formatTimeAgo } from '@/lib/utils';

export function TimeAgo({ value, className }: { value: string; className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return <time className={className} dateTime={value} title={formatFullDateTime(value)} suppressHydrationWarning>{formatTimeAgo(value, now)}</time>;
}
