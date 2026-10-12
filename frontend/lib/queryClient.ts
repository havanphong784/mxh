import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 phút cache dữ liệu server
      retry: (failureCount, error: any) => {
        // Không retry nếu lỗi xác thực hoặc không tìm thấy tài nguyên
        if (error?.response?.status === 401 || error?.response?.status === 404) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});
