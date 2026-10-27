import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="dashboard-shell grid w-full max-w-[980px] overflow-hidden rounded-[32px] bg-[#f4f2fa] lg:grid-cols-[1fr_440px] lg:rounded-[36px]">
        <div className="relative hidden min-h-[580px] overflow-hidden bg-[linear-gradient(145deg,#a7a0ff_0%,#c9b9ff_48%,#ffc8d8_100%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-10 top-16 h-56 w-56 rounded-full border-[35px] border-white/20" aria-hidden="true" />
          <div className="absolute bottom-12 left-14 h-40 w-40 rotate-[-18deg] rounded-[48px] bg-white/15" aria-hidden="true" />
          <div className="relative z-10 grid h-12 w-12 place-items-center rounded-[16px] bg-white text-[12px] font-extrabold text-[#7b78ff] shadow-[0_12px_30px_rgba(90,75,140,.17)]">MXH</div>
          <div className="relative z-10 max-w-[400px]"><span className="text-[44px]" aria-hidden="true">✦</span><h2 className="mt-5 text-[42px] font-extrabold leading-[1.12] tracking-[-0.05em]">Mỗi câu chuyện đều đáng chia sẻ.</h2><p className="mt-5 max-w-[320px] text-[14px] leading-6 text-white/90">Một góc nhỏ dịu dàng để gặp gỡ, trò chuyện và giữ lại những khoảnh khắc của bạn.</p></div>
        </div>
        <div className="auth-card flex min-h-[560px] flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:px-12">
          <div className="mb-9">
            <span className="eyebrow">Chào mừng đến MXH</span>
            <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.05em] text-[#1c1b29]">Kết nối theo cách của bạn<span className="text-[#ff8da1]">.</span></h1>
            <p className="mt-2 text-[12px] leading-5 text-[#6d6a82]">Đăng nhập hoặc tạo tài khoản để bắt đầu trò chuyện.</p>
          </div>
          {children}
          <p className="mt-10 text-center text-[11px] text-[#8e8ca3]">MXH · Những kết nối thật, mỗi ngày</p>
        </div>
      </div>
    </div>
  );
}
