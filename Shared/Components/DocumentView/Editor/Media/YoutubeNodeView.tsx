"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Button, Input } from "@heroui/react";
import { X } from "lucide-react";

const YOUTUBE_URL_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const BARE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function ExtractVideoId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(YOUTUBE_URL_ID_REGEX);
  if (match) return match[1];
  // A bare 11-char video ID pasted directly, no URL around it.
  return BARE_ID_REGEX.test(trimmed) ? trimmed : null;
}

export function YoutubeNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const videoId = node.attrs.videoId as string | null;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);

  function Commit() {
    const id = ExtractVideoId(draft);
    if (!id) {
      setError(true);
      return;
    }
    updateAttributes({ videoId: id });
  }

  if (!videoId) {
    return (
      <NodeViewWrapper data-type="youtube-embed" contentEditable={false} draggable={false}>
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-[#e2e0dc] bg-[#f9f8f7] p-4">
          <div className="flex items-center gap-1.5 text-sm text-[#5f5e59]">
            <svg width="15px" height="15px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M20.5949 4.45999C21.5421 4.71353 22.2865 5.45785 22.54 6.40501C22.9982 8.12001 23 11.7004 23 11.7004C23 11.7004 23 15.2807 22.54 16.9957C22.2865 17.9429 21.5421 18.6872 20.5949 18.9407C18.88 19.4007 12 19.4007 12 19.4007C12 19.4007 5.12001 19.4007 3.405 18.9407C2.45785 18.6872 1.71353 17.9429 1.45999 16.9957C1 15.2807 1 11.7004 1 11.7004C1 11.7004 1 8.12001 1.45999 6.40501C1.71353 5.45785 2.45785 4.71353 3.405 4.45999C5.12001 4 12 4 12 4C12 4 18.88 4 20.5949 4.45999ZM15.5134 11.7007L9.79788 15.0003V8.40101L15.5134 11.7007Z" stroke="#000000" stroke-linejoin="round" />
            </svg>
            Embed a YouTube video
          </div>
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") Commit();
              }}
              placeholder="Paste a YouTube link…"
              className="min-w-0 flex-1 rounded-lg border border-[#f0efed] bg-white px-2.5 py-1.5 text-sm text-[#2c2c2b] shadow-none outline-none focus:border-[#c9c8c4]"
            />
            <Button
              variant="ghost"
              onPress={Commit}
              className="h-auto shrink-0 rounded-lg bg-black px-3 py-1.5 text-sm font-normal text-white hover:bg-black/80"
            >
              Embed
            </Button>
          </div>
          {error ? (
            <p className="text-xs text-[#e5484d]">Couldn&apos;t find a video in that link.</p>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      data-type="youtube-embed"
      contentEditable={false}
      draggable={false}
      className="group/youtube relative my-1"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <Button
        variant="ghost"
        isIconOnly
        onPress={() => deleteNode()}
        aria-label="Remove"
        className="absolute top-2 right-2 h-auto w-auto rounded-md bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/youtube:opacity-100"
      >
        <X size={14} strokeWidth={1.75} />
      </Button>
    </NodeViewWrapper>
  );
}
