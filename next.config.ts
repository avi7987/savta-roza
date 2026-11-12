import type { NextConfig } from "next";

const nextConfig: NextConfig = process.env.STATIC_EXPORT
  ? { output: "export", images: { unoptimized: true }, distDir: ".next-static" }
  : {};

export default nextConfig;
