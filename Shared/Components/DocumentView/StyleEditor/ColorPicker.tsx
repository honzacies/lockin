"use client";

import {
  ColorArea,
  ColorField,
  ColorPicker as HeroColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  parseColor,
} from "@heroui/react";
import { COLOR_SWATCHES, ParseHexColor } from "@lockin/shared/Lib/Color";

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
}

const FALLBACK = "#2c2c2b";

/** HeroUI parseColor hází na neplatný vstup — rozbitá hodnota spadne na výchozí. */
function SafeColor(value: string | undefined) {
  return parseColor(value && ParseHexColor(value) ? value : FALLBACK);
}

/**
 * Jediný výběr barvy v appce (štítky, styly bloků, motiv dokumentu, canvas):
 * HeroUI ColorPicker bez spouště — paleta 16 barev, plocha sytost × jas,
 * posuvník odstínu a hex pole sdílí jednu barvu z kontextu pickeru.
 * Ven jde vždy hex string.
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <HeroColorPicker value={SafeColor(value)} onChange={(color) => onChange(color.toString("hex"))}>
      <div className="flex select-none flex-col gap-3">
        <ColorSwatchPicker aria-label="Preset colors" size="xs" className="grid grid-cols-8 gap-1.5">
          {COLOR_SWATCHES.map((swatch) => (
            <ColorSwatchPicker.Item key={swatch} color={swatch}>
              <ColorSwatchPicker.Swatch className="border border-black/10" />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
        <ColorArea
          aria-label="Saturation and brightness"
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
          className="h-32 w-full max-w-full rounded-lg"
        >
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider aria-label="Hue" channel="hue" colorSpace="hsb">
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <ColorField aria-label="Hex color">
          <ColorField.Group variant="secondary">
            <ColorField.Prefix>
              <ColorSwatch size="xs" />
            </ColorField.Prefix>
            <ColorField.Input className="font-mono text-[13px] uppercase" />
          </ColorField.Group>
        </ColorField>
      </div>
    </HeroColorPicker>
  );
}
