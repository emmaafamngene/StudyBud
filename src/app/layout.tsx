import type { Metadata } from "next";
import ThemeSync from "@/components/ui/ThemeSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyBud | Your learning companion",
  description: "Upload, organize, understand, and practice your study materials.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
