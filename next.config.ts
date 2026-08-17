import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack inside this project even when a parent directory contains
  // another lockfile (common in local multi-project workspaces).
  turbopack: { root: process.cwd() },
};

export default nextConfig;
