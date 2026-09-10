import type { NextConfig } from "next";

/**
 * Na rozdíl od Tauri buildu tady NENÍ `output: "export"` — web běží jako
 * normální Next server, takže smí mít dynamické routy i server komponenty.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
