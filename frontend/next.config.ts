import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
    agentUpgrade: "security",
  },
};

export default nextConfig;
