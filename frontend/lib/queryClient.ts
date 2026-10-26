import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 phút cache dữ liệu server
      retry: (failureCount, error) => {
        // Không retry nếu lỗi xác thực hoặc không tìm thấy tài nguyên
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 404)) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});
