"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Button, Input } from "@heroui/react";
import { ParseHexColor, type Rgb } from "@lockin/shared/Lib/Color";

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
}

/** A few on-brand presets plus common accents. */
const PRESET_SWATCHES = [
  "#2c2c2b",
  "#5f5e59",
  "#91918e",
  "#ffffff",
  "#3b7cff",
  "#0088ff",
  "#e5484d",
  "#e5a000",
  "#30a46c",
  "#8e4ec6",
];

function Clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function ToHex(rgb: Rgb): string {
  const part = (n: number) => Clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
}

function RgbToHsv({ r, g, b }: Rgb): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function HsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const initial = ParseHexColor(value ?? "#2c2c2b") ?? { r: 44, g: 44, b: 43 };
  const initialHsv = RgbToHsv(initial);
  const [hue, setHue] = useState(initialHsv.h);
  const [sat, setSat] = useState(initialHsv.s);
  const [val, setVal] = useState(initialHsv.v);
  const [hexInput, setHexInput] = useState(value ?? ToHex(initial));

  const areaRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const rgb = HsvToRgb(hue, sat, val);
  const hex = ToHex(rgb);

  // Keep the hex text field in sync when the user drags the SV/hue controls.
  useEffect(() => {
    setHexInput(hex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue, sat, val]);

  const Emit = useCallback(
    (next: string) => onChange(next),
    [onChange],
  );

  function UpdateFromArea(clientX: number, clientY: number) {
    const el = areaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = Clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    setSat(s);
    setVal(v);
    Emit(ToHex(HsvToRgb(hue, s, v)));
  }

  useEffect(() => {
    function OnMove(e: PointerEvent) {
      if (draggingRef.current) UpdateFromArea(e.clientX, e.clientY);
    }
    function OnUp() {
      draggingRef.current = false;
    }
    window.addEventListener("pointermove", OnMove);
    window.addEventListener("pointerup", OnUp);
    return () => {
      window.removeEventListener("pointermove", OnMove);
      window.removeEventListener("pointerup", OnUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue]);

  function CommitHex(next: string) {
    const parsed = ParseHexColor(next);
    if (!parsed) return;
    const hsv = RgbToHsv(parsed);
    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);
    Emit(ToHex(parsed));
  }

  function SetChannel(channel: keyof Rgb, raw: string) {
    const n = Clamp(parseInt(raw || "0", 10) || 0, 0, 255);
    const next = { ...rgb, [channel]: n };
    CommitHex(ToHex(next));
  }

  const hueColor = ToHex(HsvToRgb(hue, 1, 1));

  return (
    <div className="flex flex-col gap-3">
      {/* Saturation / Value area */}
      <div
        ref={areaRef}
        onPointerDown={(e) => {
          draggingRef.current = true;
          UpdateFromArea(e.clientX, e.clientY);
        }}
        className="relative h-32 w-full cursor-crosshair rounded-lg"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
      >
        <div
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
            background: hex,
          }}
        />
      </div>

      {/* Hue slider — thumb styled in globals.css (`.hue-slider-thumb`,
       * targeting the vendor-prefixed ::-webkit-/::-moz- thumb pseudo-
       * elements Tailwind classes can't reach), reading `--thumb-color`
       * below so it always shows the currently selected hue instead of the
       * browser's default accent-colored knob. */}
      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(hue)}
        onChange={(e) => {
          const h = Number(e.target.value);
          setHue(h);
          Emit(ToHex(HsvToRgb(h, sat, val)));
        }}
        className="hue-slider-thumb h-3 w-full cursor-pointer appearance-none rounded-full"
        style={
          {
            background:
              "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            "--thumb-color": hueColor,
          } as CSSProperties
        }
      />

      {/* Hex + RGB inputs */}
      <div className="flex items-center gap-2">
        <span
          className="size-7 shrink-0 rounded-md border border-[#f0efed]"
          style={{ background: hex }}
        />
        <Input
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={() => CommitHex(hexInput)}
          onKeyDown={(e) => {
            if (e.key === "Enter") CommitHex(hexInput);
          }}
          className="w-20 rounded-md border border-[#f0efed] px-2 py-1 text-[13px] text-[#2c2c2b] outline-none focus:border-[#c9c8c4]"
          aria-label="Hex color"
        />
        {(["r", "g", "b"] as const).map((ch) => (
          <Input
            key={ch}
            type="number"
            min={0}
            max={255}
            value={Math.round(rgb[ch])}
            onChange={(e) => SetChannel(ch, e.target.value)}
            className="w-14 rounded-md border border-[#f0efed] px-2 py-1 text-[13px] text-[#2c2c2b] outline-none focus:border-[#c9c8c4]"
            aria-label={`${ch.toUpperCase()} channel`}
          />
        ))}
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_SWATCHES.map((swatch) => (
          <Button
            key={swatch}
            variant="ghost"
            isIconOnly
            onPress={() => CommitHex(swatch)}
            className="h-6 w-6 rounded-md border border-[#f0efed] p-0 transition-transform hover:scale-110"
            style={{ background: swatch }}
            aria-label={`Use ${swatch}`}
          />
        ))}
      </div>
    </div>
  );
}
