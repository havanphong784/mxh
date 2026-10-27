'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createNavigationState, getBackDestination, transitionNavigation } from '@/lib/navigation-state';

const NavigationContext = createContext<{ goBack: () => void; canGoBack: boolean } | null>(null);

function scrollContainer(): HTMLElement | Window {
  const mainScrollRegion = document.getElementById('main-scroll-region');
  return window.matchMedia('(min-width: 768px)').matches && mainScrollRegion ? mainScrollRegion : window;
}

function scrollOffset(container: HTMLElement | Window): number {
  return container === window ? window.scrollY : (container as HTMLElement).scrollTop;
}

function scrollToOffset(container: HTMLElement | Window, offset: number) {
  if (container === window) window.scrollTo(0, offset);
  else (container as HTMLElement).scrollTop = offset;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = useRef(pathname);
  const history = useRef(createNavigationState(pathname));
  const positions = useRef(new Map<string, number>());
  const isPopNavigation = useRef(false);
  const isRestoring = useRef(false);
  const [canGoBack, setCanGoBack] = useState(pathname !== '/feed');

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const onPopState = () => {
      if (window.location.pathname !== currentPath.current) isPopNavigation.current = true;
    };
    const onScroll = () => {
      if (isRestoring.current || window.location.pathname !== currentPath.current) return;
      positions.current.set(currentPath.current, scrollOffset(scrollContainer()));
    };
    const region = document.getElementById('main-scroll-region');
    window.addEventListener('popstate', onPopState);
    window.addEventListener('scroll', onScroll, { passive: true });
    region?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.history.scrollRestoration = previousRestoration;
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('scroll', onScroll);
      region?.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (currentPath.current === pathname) return;
    let cleanup: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      const isPop = isPopNavigation.current;
      isPopNavigation.current = false;
      history.current = transitionNavigation(history.current, pathname, isPop ? 'pop' : 'push');
      currentPath.current = pathname;
      setCanGoBack(Boolean(getBackDestination(history.current)) || pathname !== '/feed');

      const container = scrollContainer();
      const target = isPop ? positions.current.get(pathname) ?? 0 : 0;
      isRestoring.current = true;
      let active = true;
      let settled = false;
      let settleTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (!active) return;
        active = false;
        isRestoring.current = false;
        observer?.disconnect();
        if (settleTimer) clearTimeout(settleTimer);
        clearTimeout(expiryTimer);
        window.removeEventListener('wheel', cancel);
        window.removeEventListener('touchstart', cancel);
        window.removeEventListener('pointerdown', cancel);
        if (window.location.pathname === pathname && currentPath.current === pathname) {
          positions.current.set(pathname, scrollOffset(container));
        }
      };
      const cancel = () => finish();
      const attempt = () => {
        if (!active) return;
        scrollToOffset(container, target);
        if (Math.abs(scrollOffset(container) - target) < 2 && !settled) {
          settled = true;
          settleTimer = setTimeout(() => {
            settled = false;
            scrollToOffset(container, target);
            if (Math.abs(scrollOffset(container) - target) < 2) finish();
          }, 200);
        }
      };
      const content = document.getElementById('main-page-content');
      const observer = content && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(attempt) : null;
      observer?.observe(content!);
      const expiryTimer = setTimeout(finish, 10_000);
      window.addEventListener('wheel', cancel, { passive: true });
      window.addEventListener('touchstart', cancel, { passive: true });
      window.addEventListener('pointerdown', cancel, { passive: true });
      requestAnimationFrame(() => requestAnimationFrame(attempt));
      cleanup = finish;
    });
    return () => {
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [pathname]);

  const goBack = useCallback(() => {
    positions.current.set(currentPath.current, scrollOffset(scrollContainer()));
    if (getBackDestination(history.current)) {
      isPopNavigation.current = true;
      router.back();
    }
    else if (pathname !== '/feed') router.push('/feed');
  }, [pathname, router]);

  return <NavigationContext.Provider value={{ goBack, canGoBack }}>{children}</NavigationContext.Provider>;
}

export function useAppNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error('useAppNavigation must be used inside NavigationProvider');
  return navigation;
}
