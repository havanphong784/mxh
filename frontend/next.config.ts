import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node 26 does not expose TypeScript CLI stdout to Next's detached child process.
  // Use the compiler API so production builds can still validate the same tsconfig.
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
