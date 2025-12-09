import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "神笔PPT - AI一键生成演示文稿",
  description: "输入一句话，AI帮你生成精美PPT。专为中小学生和快速演示需求设计。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
