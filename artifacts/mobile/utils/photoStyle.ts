import { Platform } from "react-native";

import { PhotoAdjustments } from "@/context/PhotosContext";

export function buildPhotoStyle(adj?: PhotoAdjustments): object {
  if (!adj) return {};

  const { brightness, contrast, saturation, warmth, rotation, flipH, flipV } = adj;

  const b = +(1 + brightness / 100).toFixed(3);
  const c = +(1 + contrast / 100).toFixed(3);
  const s = +Math.max(0, 1 + saturation / 100).toFixed(3);
  const sepiaVal = warmth > 0 ? +(warmth / 300).toFixed(3) : 0;
  const hueVal = warmth < 0 ? +(warmth / 3).toFixed(1) : 0;

  const transforms: object[] = [];
  if (rotation) transforms.push({ rotate: `${rotation}deg` });
  if (flipH) transforms.push({ scaleX: -1 });
  if (flipV) transforms.push({ scaleY: -1 });

  const style: Record<string, unknown> = {};
  if (transforms.length > 0) style.transform = transforms;

  if (Platform.OS === "web") {
    const parts: string[] = [
      `brightness(${b})`,
      `contrast(${c})`,
      `saturate(${s})`,
    ];
    if (sepiaVal > 0) parts.push(`sepia(${sepiaVal})`);
    if (hueVal < 0) parts.push(`hue-rotate(${hueVal}deg)`);
    style.filter = parts.join(" ");
  } else {
    const filters: Array<Record<string, number>> = [
      { brightness: b },
      { contrast: c },
      { saturate: s },
    ];
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
    adj.saturation !== 0 ||
    adj.warmth !== 0 ||
    adj.rotation !== 0 ||
    adj.flipH ||
    adj.flipV
  );
}
