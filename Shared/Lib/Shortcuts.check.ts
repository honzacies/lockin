// Spuštění: bun Shared/Lib/Shortcuts.check.ts
import assert from "node:assert/strict";
import { ComboFromEvent, MatchShortcut } from "./Shortcuts";

const Key = (code: string, key: string, mods: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}) => ({
  code,
  key,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

assert.equal(ComboFromEvent(Key("KeyK", "k", { ctrlKey: true })), "Ctrl+K");
// Rozložení klávesnice nevadí — počítá se fyzická klávesa.
assert.equal(ComboFromEvent(Key("KeyN", "ň", { ctrlKey: true, altKey: true })), "Ctrl+Alt+N");
assert.equal(ComboFromEvent(Key("Comma", ",", { ctrlKey: true })), "Ctrl+,");
assert.equal(ComboFromEvent(Key("ControlLeft", "Control", { ctrlKey: true })), null, "jen modifikátor");
assert.equal(ComboFromEvent(Key("KeyA", "a")), null, "bez modifikátoru by kolidovalo s psaním");
assert.equal(ComboFromEvent(Key("F5", "F5")), "F5");

assert.equal(MatchShortcut(Key("KeyK", "k", { ctrlKey: true }), {}), "search");
assert.equal(MatchShortcut(Key("KeyK", "k", { ctrlKey: true }), { search: "Ctrl+P" }), null, "přemapovaná zkratka už neplatí");
assert.equal(MatchShortcut(Key("KeyP", "p", { ctrlKey: true }), { search: "Ctrl+P" }), "search");
console.log("Shortcuts ok");
