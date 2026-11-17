# Kiểm thử E2E messaging

Playwright chạy luồng hai tài khoản trên Chromium: bắt đầu từ hồ sơ, mở deep link, gửi/nhận realtime, kiểm tra unread/read, tải tin cũ và điều hướng mobile. Test tự chạy backend trên cổng `5100` và frontend trên `3100`.

Chỉ dùng PostgreSQL local **dành riêng cho E2E**, tên database phải là `mxh_e2e`. `db init` tạo schema và `seed` thêm dữ liệu mẫu; test chỉ xóa hội thoại giữa hai tài khoản E2E trước và sau khi chạy. Không dùng database production hoặc database có dữ liệu cần giữ.

```bash
npm exec --workspace frontend -- playwright install chromium
export E2E_DATABASE_URL='postgresql://postgres:password@localhost:5432/mxh_e2e?schema=public'
npm exec --workspace backend -- prisma db init --db "$E2E_DATABASE_URL"
DATABASE_URL="$E2E_DATABASE_URL" npm run seed --workspace backend
npm run test:e2e --workspace frontend
```

Mặc định test đăng nhập `minhthu@example.test` và `quanghuy@example.test` với `Demo1234!`. Đặt `SEED_PASSWORD` khi seed và `E2E_USER_PASSWORD` khi chạy test nếu dùng mật khẩu khác; có thể thay email qua `E2E_USER_A_EMAIL` và `E2E_USER_B_EMAIL`.

## Next.js

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
