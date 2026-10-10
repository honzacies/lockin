import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Vždy definovaná, aby se při buildu vložila jako konstanta — release tak testovací mock (Platform/DevMock.ts) vůbec neobsahuje.
  env: { NEXT_PUBLIC_LOCKIN_MOCK: process.env.NEXT_PUBLIC_LOCKIN_MOCK ?? "" },
};

export default nextConfig;
