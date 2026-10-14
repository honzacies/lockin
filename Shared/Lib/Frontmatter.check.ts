// Spuštění: bun Shared/Lib/Frontmatter.check.ts
import assert from "node:assert/strict";
import { ParseFrontmatter, PatchFrontmatter } from "./Frontmatter";

const sample = `---
icon: 📘
tags: [dějepis, maturita]
favorite: true
aliases:
  - Husité
  - Hus
cssclasses: wide
---
`;

// ---- čtení ----
const parsed = ParseFrontmatter(sample);
assert.equal(parsed.icon, "📘");
assert.deepEqual(parsed.tags, ["dějepis", "maturita"]);
assert.equal(parsed.favorite, true);
assert.deepEqual(parsed.aliases, ["Husité", "Hus"], "odrážkový seznam");
assert.equal(parsed.cssclasses, "wide");
assert.deepEqual(ParseFrontmatter(""), {}, "bez frontmatteru prázdná mapa");
assert.deepEqual(ParseFrontmatter("# Jen nadpis\n"), {});
assert.equal(ParseFrontmatter('---\nname: "Ahoj: světe"\n---\n').name, "Ahoj: světe", "uvozovky");

// ---- zápis ----
const patched = PatchFrontmatter(sample, { icon: "📕", favorite: undefined, tags: ["fyzika"] });
const after = ParseFrontmatter(patched);
assert.equal(after.icon, "📕", "změněný klíč");
assert.deepEqual(after.tags, ["fyzika"]);
assert.equal(after.favorite, undefined, "undefined klíč smaže");
assert.deepEqual(after.aliases, ["Husité", "Hus"], "cizí odrážky zůstanou");
assert.equal(after.cssclasses, "wide", "cizí klíč zůstane");

// Prázdný seznam se nezapisuje — `tags: []` v souboru nikoho netěší.
assert.equal(ParseFrontmatter(PatchFrontmatter(sample, { tags: [] })).tags, undefined);

// Nový frontmatter tam, kde žádný nebyl, a zase pryč, když nic nezbude.
const created = PatchFrontmatter("", { icon: "🌿" });
assert.equal(created, "---\nicon: 🌿\n---\n");
assert.equal(PatchFrontmatter(created, { icon: undefined }), "", "poslední klíč smaže celý blok");

// Hodnoty, co by YAML rozbily, se zapíšou v uvozovkách a přečtou zpátky stejně.
for (const value of ["Ahoj: světe", "- pomlčka", "#hash", "čárka, uvnitř", '"citace"']) {
  const round = ParseFrontmatter(PatchFrontmatter("", { description: value }));
  assert.equal(round.description, value, value);
}
const list = ["a, b", "c"];
assert.deepEqual(ParseFrontmatter(PatchFrontmatter("", { tags: list })).tags, list, "čárka v položce seznamu");

// Dvakrát po sobě nesmí nic měnit — jinak by se soubor přepisoval pokaždé.
const once = PatchFrontmatter(sample, { icon: "📕" });
assert.equal(PatchFrontmatter(once, { icon: "📕" }), once, "stabilní");

console.log("Frontmatter ok");
