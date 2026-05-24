import { Platform } from "react-native";

import { PhotoAdjustments } from "@/context/PhotosContext";

const LUT_DEFS: Record<string, { b: number; c: number; s: number; sp: number; h: number }> = {
  none:    { b: 1,    c: 1,    s: 1,    sp: 0,    h: 0  },
  portra:  { b: 1.02, c: 0.95, s: 0.88, sp: 0.12, h: 4  },
  velvia:  { b: 0.97, c: 1.15, s: 1.45, sp: 0,    h: -5 },
  ektar:   { b: 1.0,  c: 1.1,  s: 1.2,  sp: 0.04, h: 2  },
  bw400:   { b: 1.02, c: 1.2,  s: 0,    sp: 0,    h: 0  },
  gold200: { b: 1.04, c: 1.0,  s: 1.08, sp: 0.18, h: 8  },
  cross:   { b: 1.0,  c: 1.35, s: 1.55, sp: 0.08, h: 15 },
  fade:    { b: 1.1,  c: 0.78, s: 0.65, sp: 0.18, h: 3  },
  chrome:  { b: 1.0,  c: 1.2,  s: 1.1,  sp: 0.05, h: 0  },
  instant: { b: 1.05, c: 0.9,  s: 0.8,  sp: 0.1,  h: 5  },
};

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
    if ((points?.length ?? 0) <= 2 && (!points || (points[0]?.x === 0 && points[1]?.x === 1))) {
      return { brightness: 0, contrast: 0 };
    }
  }
  const mid = evaluateCurve(points, 0.5);
  const lo  = evaluateCurve(points, 0.25);
  const hi  = evaluateCurve(points, 0.75);
  return {
    brightness: (mid - 0.5) * 0.6,
    contrast:   ((hi - lo) - 0.5) * 0.8,
  };
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
    gradingShadowsSat = 0, gradingMidtonesSat = 0, gradingHighlightsSat = 0,
    gradingShadowsLum = 0, gradingMidtonesLum = 0, gradingHighlightsLum = 0,
    hsl, curves, lutName = "none",
  } = adj;

  const lut = LUT_DEFS[lutName] ?? LUT_DEFS.none;

  const curveRgb = curves?.rgb ?? [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const curveEffect = getCurveEffect(curveRgb);

  const hslTotalSat = hsl ? Object.values(hsl).reduce((s, ch) => s + (ch?.s ?? 0), 0) / 8 : 0;
  const hslTotalHue = hsl ? Object.values(hsl).reduce((s, ch) => s + (ch?.h ?? 0), 0) / 8 : 0;

  const expFactor = Math.pow(2, exposure / 100);
  const gradingLumBoost = (gradingShadowsLum + gradingMidtonesLum + gradingHighlightsLum) / 300;

  const bFactor = +(
    lut.b *
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
      toneMapping * 0.001 +
      gradingLumBoost)
  ).toFixed(4);

  const cFactor = +Math.max(
    0.05,
    lut.c *
    (1 +
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
      toneMapping * 0.002)
  ).toFixed(4);

  const gradingSatBoost = (gradingShadowsSat + gradingMidtonesSat + gradingHighlightsSat) / 300;
  const sFactor = +Math.max(
    0,
    lut.s *
    (1 +
      saturation / 100 +
      vibrance * 0.005 +
      clarity * 0.003 +
      dehaze * 0.005 +
      hslTotalSat * 0.01 +
      splitHighlightsSat * 0.002 +
      splitShadowsSat * 0.002 -
      colorNoise * 0.002 +
      gradingSatBoost * 0.5)
  ).toFixed(4);

  const sepiaVal = Math.min(1, (warmth > 0 ? warmth / 300 : 0) + lut.sp);
  const hueVal = +(
    hue +
    (warmth < 0 ? warmth / 3 : 0) +
    tint * 0.3 +
    hslTotalHue * 0.5 +
    lut.h
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
    if (blurPx > 0)           parts.push(`blur(${blurPx}px)`);
    if (sepiaVal > 0)          parts.push(`sepia(${sepiaVal})`);
    if (Math.abs(hueVal) > 0.1) parts.push(`hue-rotate(${hueVal}deg)`);
    style.filter = parts.join(" ");
  } else {
    const filters: Array<Record<string, number>> = [
      { brightness: bFactor as unknown as number },
      { contrast: cFactor as unknown as number },
      { saturate: sFactor as unknown as number },
    ];
    if (blurPx > 0)   filters.push({ blur: blurPx });
    if (sepiaVal > 0) filters.push({ sepia: sepiaVal });
    style.filter = filters;
  }

  return style;
}

export function hasAdjustments(adj?: PhotoAdjustments): boolean {
  if (!adj) return false;
  const nums = [
    adj.brightness, adj.contrast, adj.highlights, adj.shadows,
    adj.whites, adj.blacks, adj.saturation, adj.vibrance,
    adj.warmth, adj.tint, adj.sharpness, adj.clarity,
    adj.dehaze, adj.noiseReduction, adj.vignette, adj.grain,
    adj.exposure ?? 0, adj.hue ?? 0, adj.texture ?? 0,
    adj.colorNoise ?? 0, adj.toneMapping ?? 0, adj.freeRotate ?? 0,
    adj.splitHighlightsHue ?? 0, adj.splitHighlightsSat ?? 0,
    adj.splitShadowsHue ?? 0, adj.splitShadowsSat ?? 0,
    adj.levelsBlack ?? 0, adj.levelsMidtone ?? 0, adj.levelsWhite ?? 0,
    adj.gradingShadowsSat ?? 0, adj.gradingMidtonesSat ?? 0, adj.gradingHighlightsSat ?? 0,
  ];
  return (
    nums.some((v) => v !== 0) ||
    adj.rotation !== 0 ||
    adj.flipH || adj.flipV ||
    (adj.lutName && adj.lutName !== "none") ||
    (adj.curves?.rgb?.length ?? 2) > 2
  );
}

export const LUT_LIST = [
  { id: "none",    name: "None" },
  { id: "portra",  name: "Portra" },
  { id: "velvia",  name: "Velvia" },
  { id: "ektar",   name: "Ektar" },
  { id: "bw400",   name: "B&W 400" },
  { id: "gold200", name: "Gold 200" },
  { id: "cross",   name: "Cross" },
  { id: "fade",    name: "Fade" },
  { id: "chrome",  name: "Chrome" },
  { id: "instant", name: "Instant" },
];

export const LUT_COLORS: Record<string, string[]> = {
  none:    ["#888", "#888"],
  portra:  ["#e8d5b7", "#c4a882"],
  velvia:  ["#3a8c5c", "#d44c2a"],
  ektar:   ["#c44030", "#4a8040"],
  bw400:   ["#555", "#ccc"],
  gold200: ["#e8c060", "#c08030"],
  cross:   ["#4040c0", "#c04080"],
  fade:    ["#b0a090", "#d0c8b8"],
  chrome:  ["#606080", "#909090"],
  instant: ["#c8b0a0", "#a09080"],
};
