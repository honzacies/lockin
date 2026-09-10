// Registruje Tauri adaptéry (fs, store, okno) jako vedlejší efekt importu.
// MUSÍ zůstat první import v souboru — story si při vytvoření sáhnou na
// úložiště a do té doby už musí být platforma známá.
import "@/Platform/Register";

import type { Metadata } from "next";
import { FONT_VARIABLE_CLASS } from "@lockin/shared/Fonts";
import { AppShell } from "@lockin/shared/Components/AppShell/AppShell";
import "@lockin/shared/Styles/globals.css";

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
