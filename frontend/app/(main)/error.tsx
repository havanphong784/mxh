"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for observability
    console.error("Unhandled UI Error in main region:", error);
  }, [error]);

  return (
    <div className="surface-card px-6 py-14 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[20px] bg-[#fff0f3] text-[24px] text-[#ff8da1]">
        ⚠
      </div>
      <h2 className="text-[18px] font-extrabold text-[#1c1b29]">
        Đã xảy ra sự cố hiển thị
      </h2>
      <p className="mx-auto mt-2 max-w-[360px] text-[13px] leading-5 text-[#6d6a82]">
        Một thành phần trong trang đã gặp lỗi bất ngờ. Bạn có thể nhấn nút bên
        dưới để thử tải lại nội dung.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={() => reset()} variant="primary">
          Thử lại
        </Button>
      </div>
    </div>
  );
}
