import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { SaveMediaFile } from "@/Lib/MediaStorage";

/**
 * Pasting an image (a screenshot, a copied file, an image copied from a
 * browser) drops it straight into a media block, uploaded the same way a
 * manual "Choose file"/drag-drop would — TipTap has no image-paste handling
 * built in, so without this a pasted image either did nothing or landed as
 * whatever incidental HTML/text happened to ride along with it.
 */
export const ImagePasteExtension = Extension.create({
  name: "imagePaste",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            // `clipboardData.files` only ever reflects an actual OS file
            // (e.g. copying a file in Explorer) — a screenshot or an
            // in-browser "Copy image" puts raw bitmap data on the clipboard
            // instead, which only ever shows up via `items` (kind "file",
            // `getAsFile()` synthesizes the File). Reading `getAsFile()`
            // synchronously here, before any `await`, matters too — some
            // browsers invalidate the backing clipboard item once the
            // event handler returns.
            const items = Array.from(event.clipboardData?.items ?? []);
            const files = items
              .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
              .map((item) => item.getAsFile())
              .filter((file): file is File => file !== null);
            if (files.length === 0) return false;

            event.preventDefault();
            for (const file of files) {
              SaveMediaFile(file)
                .then((relativePath) => {
                  editor
                    .chain()
                    .focus()
                    .insertContent({
                      type: "media",
                      attrs: { path: relativePath, mimeType: file.type, alt: "" },
                    })
                    .run();
                })
                .catch((error) => console.warn("Pasted image upload failed", error));
            }
            return true;
          },
        },
      }),
    ];
  },
});
