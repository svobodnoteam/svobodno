import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Свободно — онлайн-платформа для записи",
  description: "Платформа для онлайн-бронирования услуг",
  icons: {
    icon: [
      { url: "/brand/icons/icon-c-16-dark.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/icons/icon-c-16-dark@2x.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/brand/icons/icon-c-16-white@2x.png" },
      {
        url: "/brand/icons/icon-c-180-white.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className="h-full antialiased"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
