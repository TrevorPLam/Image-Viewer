import { Platform } from "react-native";

import { PhotoAdjustments } from "@/context/PhotosContext";

function evaluateCurve(points: { x: number; y: number }[], t: number): number {
  if (!points || points.length < 2) return t;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (t <= sorted[0].x) return sorted[0].y;
  if (t >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].x && t <= sorted[i + 1].x) {
      const frac = (t - sorted[i].x) / (sorted[i + 1].x - sorted[i].x);
      return sorted[i].y + frac * (sorted[i + 1].y - sorted[i].y);
    }
  }
  return t;
}

function getCurveEffect(points: { x: number; y: number }[]): { brightness: number; contrast: number } {
  if (!points || points.length <= 2) {
    const isDefault = points?.length === 2 && points[0].x === 0 && points[0].y === 0 && points[1].x === 1 && points[1].y === 1;
    if (isDefault) return { brightness: 0, contrast: 0 };
  }
  const mid = evaluateCurve(points, 0.5);
  const lo = evaluateCurve(points, 0.25);
  const hi = evaluateCurve(points, 0.75);
  const brightnessDelta = (mid - 0.5) * 0.6;
  const contrastDelta = ((hi - lo) - 0.5) * 0.8;
  return { brightness: brightnessDelta, contrast: contrastDelta };
}

export function buildPhotoStyle(adj?: PhotoAdjustments): object {
  if (!adj) return {};

  const {
    brightness, contrast, highlights, shadows, whites, blacks,
    saturation, vibrance, warmth, tint,
    sharpness, clarity, dehaze, noiseReduction,
    rotation, flipH, flipV,
    exposure = 0, hue = 0, texture = 0, colorNoise = 0,
    toneMapping = 0, freeRotate = 0,
    levelsBlack = 0, levelsMidtone = 0, levelsWhite = 0,
    levelsOutBlack = 0, levelsOutWhite = 0,
    splitHighlightsSat = 0, splitShadowsSat = 0,
    hsl, curves,
  } = adj;

  const curveRgb = curves?.rgb ?? [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const curveEffect = getCurveEffect(curveRgb);

  const hslTotalSat = hsl
    ? Object.values(hsl).reduce((sum, ch) => sum + (ch?.s ?? 0), 0) / 8
    : 0;
  const hslTotalHue = hsl
    ? Object.values(hsl).reduce((sum, ch) => sum + (ch?.h ?? 0), 0) / 8
    : 0;

  const expFactor = Math.pow(2, exposure / 100);

  const bFactor = +(
    expFactor *
    (1 +
      brightness / 100 +
      highlights * 0.004 +
      shadows * 0.003 +
      whites * 0.004 +
      blacks * 0.002 +
      levelsMidtone * 0.004 +
      levelsOutBlack * -0.002 +
      curveEffect.brightness +
      toneMapping * 0.001)
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
      texture * 0.004 +
      dehaze * 0.004 +
      levelsBlack * 0.003 +
      levelsWhite * -0.002 +
      levelsOutWhite * -0.001 +
      curveEffect.contrast +
      toneMapping * 0.002
  ).toFixed(4);

  const sFactor = +Math.max(
    0,
    1 +
      saturation / 100 +
      vibrance * 0.005 +
      clarity * 0.003 +
      dehaze * 0.005 +
      hslTotalSat * 0.01 +
      splitHighlightsSat * 0.002 +
      splitShadowsSat * 0.002 -
      colorNoise * 0.002
  ).toFixed(4);

  const sepiaVal = warmth > 0 ? +(warmth / 300).toFixed(4) : 0;
  const hueVal = +(
    hue +
    (warmth < 0 ? warmth / 3 : 0) +
    tint * 0.3 +
    hslTotalHue * 0.5
  ).toFixed(2);

  const blurPx = +(noiseReduction * 0.015).toFixed(3);

  const totalRotation = (rotation || 0) + (freeRotate || 0);
  const transforms: object[] = [];
  if (totalRotation) transforms.push({ rotate: `${totalRotation}deg` });
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
  const def = [
    adj.brightness, adj.contrast, adj.highlights, adj.shadows,
    adj.whites, adj.blacks, adj.saturation, adj.vibrance,
    adj.warmth, adj.tint, adj.sharpness, adj.clarity,
    adj.dehaze, adj.noiseReduction, adj.vignette, adj.grain,
    adj.exposure ?? 0, adj.hue ?? 0, adj.texture ?? 0,
    adj.colorNoise ?? 0, adj.toneMapping ?? 0, adj.freeRotate ?? 0,
    adj.splitHighlightsHue ?? 0, adj.splitHighlightsSat ?? 0,
    adj.splitShadowsHue ?? 0, adj.splitShadowsSat ?? 0,
    adj.levelsBlack ?? 0, adj.levelsMidtone ?? 0, adj.levelsWhite ?? 0,
  ];
  return (
    def.some((v) => v !== 0) ||
    adj.rotation !== 0 ||
    adj.flipH || adj.flipV ||
    (adj.curves?.rgb?.length ?? 2) > 2 ||
    (adj.curves?.r?.length ?? 2) > 2 ||
    (adj.curves?.g?.length ?? 2) > 2 ||
    (adj.curves?.b?.length ?? 2) > 2
  );
}
