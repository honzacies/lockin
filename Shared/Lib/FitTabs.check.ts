// Spuštění: bun Shared/Lib/FitTabs.check.ts
import assert from "node:assert/strict";
import { FitTabs } from "./FitTabs";

assert.deepEqual(FitTabs([100, 100, 100], 2, 400, 50), [100, 100, 100], "vejde se → beze změny");
assert.deepEqual(FitTabs([100, 100, 100], 2, 250, 50), [50, 100, 100], "ubírá se zleva");
assert.deepEqual(FitTabs([100, 100, 100], 0, 200, 50), [100, 50, 50], "aktivní tab zůstává celý");
assert.deepEqual(FitTabs([100, 100], 1, 10, 50), [50, 100], "pod minimum ne — zbytek řeší scroll");
console.log("FitTabs ok");
