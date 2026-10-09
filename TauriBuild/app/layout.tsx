import type { Metadata } from "next";
import { FONT_VARIABLE_CLASS } from "@lockin/shared/Fonts";
import { TauriShell } from "@/Components/TauriShell";
import "@lockin/shared/Styles/globals.css";
import { THEME_BOOT_SCRIPT } from "@lockin/shared/Lib/ThemeBoot";

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
    <html lang="en" className={`${FONT_VARIABLE_CLASS} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Motiv dřív, než se cokoliv vykreslí — jinak dark mode problikne bílou. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <TauriShell>{children}</TauriShell>
      </body>
    </html>
  );
}
