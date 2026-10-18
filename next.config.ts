import type { NextConfig } from "next";
// Keep production output separate from Next's dev cache and older failed builds.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir: ".next-bundle",
  allowedDevOrigins: ["192.168.1.89", "localhost", "127.0.0.1", "*.local"],
  experimental: { cpus: 1 },
};
export default nextConfig;
