import { useEffect, useRef } from "react";

/** Trigger cursor pagination when its sentinel approaches the scroll boundary. */
export function InfiniteScrollSentinel({
  enabled,
  onVisible,
  root,
  rootMargin = "0px 0px 320px 0px",
}: {
  enabled: boolean;
  onVisible: () => void;
  root?: Element | null;
  rootMargin?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sentinel.current;
    if (!enabled || !element || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible();
      },
      { root: root ?? null, rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, onVisible, root, rootMargin]);

  return <div ref={sentinel} aria-hidden="true" />;
}
