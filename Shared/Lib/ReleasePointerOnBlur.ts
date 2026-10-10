/**
 * Alt+Tab uprostřed tažení: okno ztratí fokus, `pointerup` nikdy nepřijde a
 * aplikace si myslí, že tlačítko je pořád dole (kreslí se dál, tab se táhne…).
 * Při `blur` proto pošleme syntetický `pointerup` na poslední pozici kurzoru —
 * elementu, který drží pointer capture, odkud probublá až na `window`, takže
 * ho dostanou všechny handlery tažení bez ohledu na to, kde poslouchají.
 */
let installed = false;

export function ReleasePointerOnBlur(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const captured = new Set<Element>();
  let last = { x: 0, y: 0, pointerId: 1, pressed: false };

  const Track = (e: PointerEvent) => {
    last = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, pressed: e.buttons !== 0 };
  };
  window.addEventListener("pointerdown", Track, true);
  window.addEventListener("pointermove", Track, true);
  window.addEventListener("pointerup", (e) => (Track(e), (last.pressed = false)), true);
  document.addEventListener("gotpointercapture", (e) => captured.add(e.target as Element), true);
  document.addEventListener("lostpointercapture", (e) => captured.delete(e.target as Element), true);

  window.addEventListener("blur", () => {
    if (!last.pressed && !captured.size) return;
    const init: PointerEventInit = { bubbles: true, clientX: last.x, clientY: last.y, pointerId: last.pointerId, button: 0 };
    const targets = captured.size ? [...captured] : [window];
    captured.clear();
    last.pressed = false;
    for (const target of targets) target.dispatchEvent(new PointerEvent("pointerup", init));
  });
}
