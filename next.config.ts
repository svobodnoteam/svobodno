import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Скрывает букву N (индикатор Next.js) в левом нижнем углу
  devIndicators: false,
};

export default nextConfig;
