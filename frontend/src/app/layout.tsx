import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalNotify } from "@/components/GlobalNotify";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Quản lý nhà trọ",
    template: "%s · Quản lý nhà trọ",
  },
  description: "Nền tảng quản lý nhà trọ SaaS dành cho chủ nhà trọ, người thuê và quản trị viên.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
        <GlobalNotify />
      </body>
    </html>
  );
}
