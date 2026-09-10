import {
  Inter,
  Roboto,
  Open_Sans,
  Montserrat,
  Poppins,
  Nunito,
  Lora,
  Merriweather,
  Playfair_Display,
  PT_Serif,
  Source_Serif_4,
  JetBrains_Mono,
  Fira_Code,
  Source_Code_Pro,
  IBM_Plex_Mono,
  Space_Mono,
} from "next/font/google";

/**
 * Curated, self-hosted Google-font set offered by the block-style FontPicker.
 * Each font declares a CSS variable applied on <html>; FONT_OPTIONS then maps
 * a picker entry to `var(--font-x), <category fallback>`.
 *
 * Variable fonts omit `weight`; the rest pin a small usable weight set so
 * next/font doesn't error at build time.
 */

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"] });
const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });
const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["400", "700"],
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});
const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});
const firaCode = Fira_Code({ variable: "--font-fira-code", subsets: ["latin"] });
const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  subsets: ["latin"],
});
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const FONTS = [
  inter,
  roboto,
  openSans,
  montserrat,
  poppins,
  nunito,
  lora,
  merriweather,
  playfair,
  ptSerif,
  sourceSerif,
  jetbrainsMono,
  firaCode,
  sourceCodePro,
  ibmPlexMono,
  spaceMono,
];

/** Space-separated CSS-variable classes to spread onto <html>. */
export const FONT_VARIABLE_CLASS = FONTS.map((f) => f.variable).join(" ");

export type FontCategory = "sans" | "serif" | "mono";

export interface FontOption {
  id: string;
  label: string;
  category: FontCategory;
  /** Full font-family value to assign to a BlockStyle.fontFamily. */
  cssValue: string;
}

const FALLBACK: Record<FontCategory, string> = {
  sans: "system-ui, sans-serif",
  serif: "Georgia, serif",
  mono: "monospace",
};

function Option(
  id: string,
  label: string,
  category: FontCategory,
  variable: string,
): FontOption {
  return {
    id,
    label,
    category,
    cssValue: `var(${variable}), ${FALLBACK[category]}`,
  };
}

export const FONT_OPTIONS: FontOption[] = [
  Option("inter", "Inter", "sans", "--font-inter"),
  Option("roboto", "Roboto", "sans", "--font-roboto"),
  Option("open-sans", "Open Sans", "sans", "--font-open-sans"),
  Option("montserrat", "Montserrat", "sans", "--font-montserrat"),
  Option("poppins", "Poppins", "sans", "--font-poppins"),
  Option("nunito", "Nunito", "sans", "--font-nunito"),
  Option("lora", "Lora", "serif", "--font-lora"),
  Option("merriweather", "Merriweather", "serif", "--font-merriweather"),
  Option("playfair", "Playfair Display", "serif", "--font-playfair"),
  Option("pt-serif", "PT Serif", "serif", "--font-pt-serif"),
  Option("source-serif", "Source Serif 4", "serif", "--font-source-serif"),
  Option("jetbrains-mono", "JetBrains Mono", "mono", "--font-jetbrains-mono"),
  Option("fira-code", "Fira Code", "mono", "--font-fira-code"),
  Option("source-code-pro", "Source Code Pro", "mono", "--font-source-code-pro"),
  Option("ibm-plex-mono", "IBM Plex Mono", "mono", "--font-ibm-plex-mono"),
  Option("space-mono", "Space Mono", "mono", "--font-space-mono"),
];

/** Representative default per category shown as the top quick-pick tiles. */
export const FONT_CATEGORY_DEFAULT: Record<FontCategory, string> = {
  sans: "inter",
  serif: "lora",
  mono: "jetbrains-mono",
};
