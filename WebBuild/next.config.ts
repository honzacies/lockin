import path from "node:path";
import type { NextConfig } from "next";

/**
 * Na rozdíl od Tauri buildu tady NENÍ `output: "export"` — web běží jako
 * normální Next server, takže smí mít dynamické routy i server komponenty.
 *
 * `standalone` zabalí do `.next/standalone` server i s potřebnými závislostmi,
 * takže výsledný Docker image nemusí nést celé `node_modules`.
 *
 * `outputFileTracingRoot` je v monorepu povinný: tracing má ve výchozím stavu
 * kořen v adresáři projektu (WebBuild/), takže by `Shared/` — tedy skoro celou
 * aplikaci — do výstupu vůbec nezahrnul.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
