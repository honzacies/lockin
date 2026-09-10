import type { Metadata } from "next";
import { FONT_VARIABLE_CLASS } from "./Fonts";
import { AppShell } from "@/Components/AppShell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lockin",
  description: "Lockin — projects, notes and sketches in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${FONT_VARIABLE_CLASS} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
