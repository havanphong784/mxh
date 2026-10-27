'use client';

import { usePathname } from 'next/navigation';
import { pageTitle } from '@/components/common/page-title';
import { useAppNavigation } from '@/components/common/NavigationProvider';

export function TopBar() {
  const pathname = usePathname();
  const { goBack, canGoBack } = useAppNavigation();

  return <header className="mb-5 flex items-center gap-3 pt-2 xl:mb-7">
    <button type="button" onClick={goBack} disabled={!canGoBack} aria-label="Quay lại" className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-white text-[#7b78ff] transition-colors hover:bg-[#eeedff] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
    </button>
    <h1 className="min-w-0 truncate text-[24px] font-extrabold leading-tight tracking-[-0.04em] text-[#1c1b29] sm:text-[30px]">{pageTitle(pathname)}</h1>
  </header>;
}
