import { Platform } from "react-native";

import { PhotoAdjustments } from "@/context/PhotosContext";

export function buildPhotoStyle(adj?: PhotoAdjustments): object {
  if (!adj) return {};

  const {
    brightness, contrast, highlights, shadows, whites, blacks,
    saturation, vibrance, warmth, tint,
    sharpness, clarity, dehaze, noiseReduction,
    rotation, flipH, flipV,
  } = adj;

  // ── Tonal/brightness combine ─────────────────────────────────────────────
  const bFactor = +(
    1 +
    brightness / 100 +
    highlights * 0.004 +
    shadows * 0.003 +
    whites * 0.004 +
    blacks * 0.002
  ).toFixed(4);

  const cFactor = +Math.max(
    0.05,
    1 +
      contrast / 100 +
      highlights * 0.002 -
      shadows * 0.002 -
      blacks * 0.003 +
      sharpness * 0.003 +
      clarity * 0.005 +
      dehaze * 0.004
  ).toFixed(4);

  // ── Color ────────────────────────────────────────────────────────────────
  const sFactor = +Math.max(
    0,
    1 + saturation / 100 + vibrance * 0.005 + clarity * 0.003 + dehaze * 0.005
  ).toFixed(4);

  const sepiaVal = warmth > 0 ? +(warmth / 300).toFixed(4) : 0;
  const hueVal = +((warmth < 0 ? warmth / 3 : 0) + tint * 0.3).toFixed(2);

  // ── Noise reduction (slight blur) ────────────────────────────────────────
  const blurPx = +(noiseReduction * 0.015).toFixed(3); // 0 – 1.5 px

  // ── Transform ────────────────────────────────────────────────────────────
  const transforms: object[] = [];
  if (rotation) transforms.push({ rotate: `${rotation}deg` });
  if (flipH) transforms.push({ scaleX: -1 });
  if (flipV) transforms.push({ scaleY: -1 });

  const style: Record<string, unknown> = {};
  if (transforms.length > 0) style.transform = transforms;

  if (Platform.OS === "web") {
    const parts: string[] = [
      `brightness(${bFactor})`,
      `contrast(${cFactor})`,
      `saturate(${sFactor})`,
    ];
    if (blurPx > 0) parts.push(`blur(${blurPx}px)`);
    if (sepiaVal > 0) parts.push(`sepia(${sepiaVal})`);
    if (Math.abs(hueVal) > 0.1) parts.push(`hue-rotate(${hueVal}deg)`);
    style.filter = parts.join(" ");
  } else {
    const filters: Array<Record<string, number>> = [
      { brightness: bFactor },
      { contrast: cFactor },
      { saturate: sFactor },
    ];
    if (blurPx > 0) filters.push({ blur: blurPx });
    if (sepiaVal > 0) filters.push({ sepia: sepiaVal });
    style.filter = filters;
  }

  return style;
}

export function hasAdjustments(adj?: PhotoAdjustments): boolean {
  if (!adj) return false;
  return (
    adj.brightness !== 0 ||
    adj.contrast !== 0 ||
    adj.highlights !== 0 ||
    adj.shadows !== 0 ||
    adj.whites !== 0 ||
    adj.blacks !== 0 ||
    adj.saturation !== 0 ||
    adj.vibrance !== 0 ||
    adj.warmth !== 0 ||
    adj.tint !== 0 ||
    adj.sharpness !== 0 ||
    adj.clarity !== 0 ||
    adj.dehaze !== 0 ||
    adj.noiseReduction !== 0 ||
    adj.vignette !== 0 ||
    adj.grain !== 0 ||
    adj.rotation !== 0 ||
    adj.flipH ||
    adj.flipV
  );
}
