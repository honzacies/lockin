// Spuštění: bun Shared/Lib/DocumentLock.check.ts
import assert from "node:assert/strict";
import { CreateLock, ForgetKey, OpenLock, ResealLock, UnlockedKey } from "./DocumentLock";

const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Tajné" }] },
    { type: "paragraph", content: [{ type: "text", text: "Heslo je 1234, ale to nikomu neříkej." }] },
  ],
};

const lock = await CreateLock("doc-1", doc, "správné heslo");

// Šifrovaný text nesmí nic prozradit.
assert.ok(!lock.ciphertext.includes("Tajné"), "šifrovaný text neobsahuje obsah");
assert.ok(lock.salt && lock.nonce && lock.ciphertext);
assert.ok(UnlockedKey("doc-1"), "po zamčení zůstává klíč v paměti");

// Správné heslo vrátí přesně původní dokument.
ForgetKey("doc-1");
assert.deepEqual(await OpenLock("doc-1", lock, "správné heslo"), doc);

// Špatné heslo musí selhat, ne vrátit nesmysl.
ForgetKey("doc-1");
await assert.rejects(() => OpenLock("doc-1", lock, "špatné heslo"), "špatné heslo vyhodí výjimku");
await assert.rejects(() => OpenLock("doc-1", lock, ""), "prázdné heslo vyhodí výjimku");

// Poškozený šifrovaný text taky neprojde (ověření GCM).
const damaged = { ...lock, ciphertext: lock.ciphertext.slice(0, -4) + "AAAA" };
await assert.rejects(() => OpenLock("doc-1", damaged, "správné heslo"), "změněný text neprojde");

// Každé uložení má vlastní nonce, ale heslo zůstává stejné.
const key = (await OpenLock("doc-1", lock, "správné heslo"), UnlockedKey("doc-1"))!;
const edited = { ...doc, content: [...doc.content, { type: "paragraph", content: [{ type: "text", text: "Dodatek." }] }] };
const resealed = await ResealLock(key, lock, edited);
assert.notEqual(resealed.nonce, lock.nonce, "nový nonce");
assert.equal(resealed.salt, lock.salt, "sůl zůstává, heslo se nemění");
ForgetKey("doc-1");
assert.deepEqual(await OpenLock("doc-1", resealed, "správné heslo"), edited);

console.log("DocumentLock ok");
