import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { MobileNav } from '@/components/layout/MobileNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      {/* 1. Sidebar cố định bên trái (80px trên desktop, ẩn trên mobile) */}
      <Sidebar />

      {/* 2. Cột nội dung trung tâm */}
      <div className="flex-1 flex flex-col items-center">
        <TopBar />
        {/* Khung feed tối đa 600px theo chuẩn Threads, viền hairline 1px 2 bên */}
        <main className="w-full max-w-[600px] min-h-[calc(100vh-56px)] bg-[#ffffff] border-x border-[#d5d5d5] pb-16 md:pb-6">
          {children}
        </main>
      </div>

      {/* 3. Thanh điều hướng đáy màn hình cho mobile */}
      <MobileNav />
    </div>
  );
}
