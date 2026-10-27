import {Sidebar} from '@/components/layout/Sidebar';
import {TopBar} from '@/components/layout/TopBar';
import {MobileNav} from '@/components/layout/MobileNav';
import {DiscoveryPanel} from '@/components/layout/DiscoveryPanel';
import {RightPanel} from '@/components/layout/RightPanel';
import {RealtimeBridge} from '@/features/realtime/components/RealtimeBridge';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:h-dvh md:p-4">
      <RealtimeBridge />
      <div className="dashboard-shell mx-auto min-h-dvh w-full bg-[#f4f2fa] md:h-full md:min-h-0 md:max-w-[1600px] md:overflow-hidden md:rounded-[36px]">
        <div className="grid grid-cols-1 md:h-full md:min-h-0 md:grid-cols-[64px_minmax(0,1fr)] xl:grid-cols-[64px_180px_minmax(0,1fr)_300px]">
          <Sidebar />
          <DiscoveryPanel />
          <div className="min-w-0 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 sm:px-6 md:h-full md:min-h-0 md:overflow-y-auto md:overscroll-contain md:pb-8 xl:px-7 xl:pt-5">
            <TopBar />
            <main className="mx-auto w-full max-w-[700px]">
              {children}
            </main>
          </div>
          <RightPanel />
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
