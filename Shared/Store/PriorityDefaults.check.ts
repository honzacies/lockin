// Spuštění: bun Shared/Store/PriorityDefaults.check.ts
import assert from "node:assert/strict";
import { DEFAULT_PRIORITIES, UpgradeUntouched } from "./UsePriorityStore";

const stored = [
  { id: "low", label: "Low", color: "#8b8d98" }, // nesahaná → nový vzhled
  { id: "medium", label: "Střední", color: "#f5a524" }, // přejmenovaná → zůstává
  { id: "high", label: "High", color: "#e5484d", icon: "lucide:flame" }, // vlastní ikona → zůstává
  { id: "priority-x", label: "Mine", color: "#123456" }, // vlastní volba → zůstává
];
const out = UpgradeUntouched(stored, DEFAULT_PRIORITIES);
assert.deepEqual(out[0], DEFAULT_PRIORITIES[0]);
assert.deepEqual(out.slice(1), stored.slice(1));
console.log("Priority defaults ok");
