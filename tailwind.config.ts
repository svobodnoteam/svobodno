import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#5EC9A0",
          dark: "#1F1F1F",
          light: "#F9F9F9",
          textDark: "#333333",
          textLight: "#E0E0E0",
        },
      },
    },
  },
};

export default config;
