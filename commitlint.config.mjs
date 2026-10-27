export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Có thể tùy chỉnh thêm scope hợp lệ nếu muốn (không bắt buộc)
    // "scope-enum": [2, "always", ["frontend", "backend", "auth", "posts", "social", "media"]],
    "type-enum": [
      2,
      "always",
      [
        "feat",     // Tính năng mới
        "fix",      // Sửa lỗi
        "docs",     // Tài liệu
        "style",    // Format code (không ảnh hưởng logic)
        "refactor", // Tái cấu trúc code
        "perf",     // Cải thiện hiệu năng
        "test",     // Viết hoặc sửa test
        "build",    // Thay đổi build system hoặc dependencies
        "ci",       // Thay đổi file CI/CD
        "chore",    // Việc vặt, cấu hình linh tinh
        "revert",   // Hoàn tác commit trước đó
      ],
    ],
    "subject-case": [0], // Cho phép viết chữ thường hoặc chữ hoa trong phần mô tả
  },
};