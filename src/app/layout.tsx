import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Digitaler Schreibtisch",
  description: "Marcels persönliches Dashboard",
  verification: {
    google: "REHtpmRJ9YtxuBi70BFER8f5KYZLSaNhYhzCHRnmj4I",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full bg-[#0b0c13] text-zinc-100">
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
