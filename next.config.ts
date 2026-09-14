import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Скрывает букву N (индикатор Next.js) в левом нижнем углу
  devIndicators: false,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "query", key: "slug" }],
          destination: "/book",
        },
      ],
    };
  },
};

export default nextConfig;
