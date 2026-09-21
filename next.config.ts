import type { NextConfig } from "next";

// Kairos is 100% offline (localStorage + service worker). For static hosting /
// APK wrapping via PWABuilder or Bubblewrap, set `output: "export"` here.
// It is left in server mode in this environment so the platform healthcheck
// route (/api/health) keeps responding.
const nextConfig: NextConfig = {};

export default nextConfig;
