import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.MXH_BACKEND_URL || "http://localhost:5000";
  const proxy = {
    "/api/v1": { target, changeOrigin: true },
    "/socket.io": { target, changeOrigin: true, ws: true },
  };
  return {
    server: { host: "localhost", port: 3000, strictPort: true, proxy },
    preview: { host: "localhost", port: 3000, strictPort: true, proxy },
  };
});
