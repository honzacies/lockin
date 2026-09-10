"use client";

import { useEffect } from "react";
import { Button, Modal, useOverlayState } from "@heroui/react";
import { TriangleAlert } from "lucide-react";

/**
 * Upozornění na beta verzi. Vyskočí při **každém** načtení stránky — schválně
 * se nikam neukládá, že ho uživatel už viděl.
 *
 * Komponenta se připojuje v `WebShell`, tedy jednou za načtení dokumentu.
 * Přechody mezi stránkami uvnitř aplikace ji tím pádem znovu nevyvolají,
 * což je záměr: „otevření stránky", ne „každý klik".
 *
 * Až bude appka ve stavu, kdy to nebude potřeba, stačí smazat tenhle soubor
 * a jeho jediné použití ve `WebShell`.
 */
export function BetaNotice() {
  const state = useOverlayState();

  useEffect(() => {
    state.open();
    // Jen při připojení — `state` mění identitu při každém překreslení a
    // závislost na něm by dialog otevírala pořád dokola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal state={state}>
      {/* `isDismissable={false}` — kliknutí vedle dialog nezavře. Je to jediná
        * věc na obrazovce a uživatel má to varování opravdu přečíst. */}
      <Modal.Backdrop isDismissable={false} className="bg-black/40">
        <Modal.Container placement="center" className="w-full max-w-[440px] px-6">
          <Modal.Dialog className="rounded-xl border border-[#f0efed] bg-white shadow-xl">
            <Modal.Header className="flex flex-row items-center gap-2 border-b border-[#f0efed] px-4 py-3">
              <Modal.Icon>
                <TriangleAlert size={16} strokeWidth={1.75} className="text-[#e5a000]" />
              </Modal.Icon>
              <Modal.Heading className="text-[15px] font-medium text-[#2c2c2b]">
                This is a beta
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3 px-4 py-4">
              <p className="text-[13px] leading-relaxed text-[#5f5e59]">
                Heads up — this is a beta version. Better not to keep anything important
                here. Things can break and things can change.
              </p>
              <p className="text-[13px] leading-relaxed text-[#5f5e59]">
                Once it&apos;s in a state where that&apos;s no longer true, this notice
                will disappear.
              </p>
            </Modal.Body>

            <Modal.Footer className="flex flex-row justify-end border-t border-[#f0efed] px-4 py-3">
              <Button
                variant="primary"
                onPress={() => state.close()}
                className="h-auto justify-center rounded-lg bg-black px-3 py-1.5 text-[13px] font-normal text-white"
              >
                Got it
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
