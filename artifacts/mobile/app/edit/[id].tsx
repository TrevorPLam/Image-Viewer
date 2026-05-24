import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Circle,
  Defs,
  FeColorMatrix,
  FeTurbulence,
  Filter,
  Line,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
  Svg,
  LinearGradient as SvgLinearGradient,
  Ellipse,
} from "react-native-svg";

import ColorGradingWheel, { WheelValue } from "@/components/ColorGradingWheel";
import CurveEditor from "@/components/CurveEditor";
import HSLPanel from "@/components/HSLPanel";
import PresetsPanel from "@/components/PresetsPanel";
import {
  CurvePoint,
  CurveSet,
  DEFAULT_ADJUSTMENTS,
  HslAdjustments,
  PhotoAdjustments,
  usePhotos,
} from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";
import { buildPhotoStyle, LUT_COLORS, LUT_LIST } from "@/utils/photoStyle";

const { width: SW, height: SH } = Dimensions.get("window");
const PREVIEW_H = Math.round(SH * 0.42);

type Tab = "transform" | "adjust" | "color" | "detail" | "curves" | "filters" | "retouch" | "masks";
type HistMode = "luma" | "rgb" | "waveform" | "vectorscope";
type CurveChannel = "rgb" | "r" | "g" | "b";
type GridMode = "off" | "thirds" | "golden";

type NumKey =
  | "brightness" | "contrast" | "highlights" | "shadows" | "whites" | "blacks"
  | "saturation" | "vibrance" | "warmth" | "tint" | "sharpness" | "clarity"
  | "dehaze" | "noiseReduction" | "vignette" | "grain"
  | "exposure" | "hue" | "texture" | "colorNoise"
  | "sharpeningRadius" | "sharpeningMasking" | "toneMapping" | "freeRotate"
  | "splitHighlightsHue" | "splitHighlightsSat"
  | "splitShadowsHue" | "splitShadowsSat"
  | "levelsBlack" | "levelsMidtone" | "levelsWhite"
  | "levelsOutBlack" | "levelsOutWhite"
  | "perspectiveV" | "perspectiveH" | "lensDistortion" | "defringe"
  | "graduatedFilterStrength" | "graduatedFilterAngle" | "graduatedFilterFeather"
  | "radialFilterStrength" | "radialFilterFeather"
  | "aiDenoise" | "skinSmoothing"
  | "maskBrushStrength" | "maskGradientStrength" | "maskRadialStrength"
  | "maskLuminosityLow" | "maskLuminosityHigh"
  | "colorReplaceTargetHue" | "colorReplaceRange" | "colorReplaceHue" | "colorReplaceSat";

// ─── EditSlider ──────────────────────────────────────────────────────────────
interface SliderProps {
  label: string; value: number; min?: number; max?: number;
  onValueChange: (v: number) => void; accent: string; unit?: string;
}

function EditSlider({ label, value, min = -100, max = 100, onValueChange, accent, unit }: SliderProps) {
  const [trackW, setTrackW] = useState(260);
  const startXRef = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        startXRef.current = e.nativeEvent.locationX;
        const x = Math.max(0, Math.min(e.nativeEvent.locationX, trackW));
        onValueChange(Math.round(min + (x / trackW) * (max - min)));
      },
      onPanResponderMove: (_, gs) => {
        const x = Math.max(0, Math.min(startXRef.current + gs.dx, trackW));
        onValueChange(Math.round(min + (x / trackW) * (max - min)));
      },
    })
  ).current;

  const thumbPct = Math.max(0, Math.min((value - min) / (max - min), 1));
  const centerPct = -min / (max - min);
  const fillL = Math.min(centerPct, thumbPct) * trackW;
  const fillW = Math.abs(thumbPct - centerPct) * trackW;
  const thumbL = Math.max(0, thumbPct * trackW - 11);
  const displayVal = unit ? `${value > 0 ? "+" : ""}${value}${unit}` : value > 0 ? `+${value}` : `${value}`;

  return (
    <View style={sl.wrap}>
      <View style={sl.hdr}>
        <Text style={sl.lbl}>{label}</Text>
        <Text style={[sl.val, { color: value !== 0 ? accent : "rgba(255,255,255,0.38)" }]}>
          {displayVal}
        </Text>
      </View>
      <View style={sl.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
        <View style={sl.trackBg} />
        <View style={[sl.fill, { left: fillL, width: Math.max(0, fillW), backgroundColor: accent }]} />
        <View style={[sl.center, { left: centerPct * trackW - 0.75 }]} />
        <View style={[sl.thumb, { left: thumbL }]} />
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  wrap: { gap: 10 },
  hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lbl: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_500Medium" },
  val: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 40, textAlign: "right" },
  track: { height: 40, justifyContent: "center" },
  trackBg: { position: "absolute", left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2 },
  fill: { position: "absolute", height: 3, borderRadius: 2 },
  center: { position: "absolute", width: 1.5, height: 10, top: "50%", marginTop: -5, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 1 },
  thumb: { position: "absolute", width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", top: "50%", marginTop: -11, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 3 },
});

// ─── Vignette Overlay ────────────────────────────────────────────────────────
function VignetteOverlay({ amount }: { amount: number }) {
  if (amount === 0) return null;
  const opacity = Math.abs(amount) / 100;
  const isLight = amount < 0;
  const stopColor = isLight ? "white" : "black";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="vig" cx="50%" cy="50%" rx="60%" ry="60%">
            <Stop offset="0%" stopColor={stopColor} stopOpacity={0} />
            <Stop offset="100%" stopColor={stopColor} stopOpacity={opacity} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vig)" />
      </Svg>
    </View>
  );
}

// ─── Grain Overlay ───────────────────────────────────────────────────────────
function GrainOverlay({ amount }: { amount: number }) {
  if (amount === 0) return null;
  const grainOpacity = +(amount / 160).toFixed(3);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Filter id="grain-f" x="0%" y="0%" width="100%" height="100%">
            <FeTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" result="noise" />
            <FeColorMatrix type="saturate" values="0" in="noise" result="grey" />
          </Filter>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" filter="url(#grain-f)" opacity={grainOpacity} />
      </Svg>
    </View>
  );
}

// ─── Crop Overlay (aspect ratio mode) ────────────────────────────────────────
function CropOverlay({ aspect }: { aspect: string }) {
  if (!aspect || aspect === "free") return null;
  const parts = aspect.split(":");
  const aw = parseFloat(parts[0]);
  const ah = parseFloat(parts[1]);
  if (!aw || !ah) return null;
  const imgRatio = SW / PREVIEW_H;
  const cropRatio = aw / ah;
  let maskHPx = 0;
  let maskWPx = 0;
  if (cropRatio > imgRatio) {
    maskHPx = Math.round(((1 - imgRatio / cropRatio) / 2) * PREVIEW_H);
  } else {
    maskWPx = Math.round(((1 - cropRatio / imgRatio) / 2) * SW);
  }
  const overlay = "rgba(0,0,0,0.52)";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {maskHPx > 0 && (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: maskHPx, backgroundColor: overlay }} />
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: maskHPx, backgroundColor: overlay }} />
        </>
      )}
      {maskWPx > 0 && (
        <>
          <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: maskWPx, backgroundColor: overlay }} />
          <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: maskWPx, backgroundColor: overlay }} />
        </>
      )}
      <View style={{ position: "absolute", top: maskHPx, bottom: maskHPx, left: maskWPx, right: maskWPx, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.75)" }} />
    </View>
  );
}

// ─── Manual Crop Overlay (free drag handles) ─────────────────────────────────
type CropHandle = "tl"|"tc"|"tr"|"ml"|"mr"|"bl"|"bc"|"br"|"move";

function ManualCropOverlay({ cropX, cropY, cropW, cropH, onChange }: {
  cropX: number; cropY: number; cropW: number; cropH: number;
  onChange: (x: number, y: number, w: number, h: number) => void;
}) {
  const W = SW;
  const H = PREVIEW_H;
  const HANDLE = 20;
  const THRESHOLD = 26;
  const OV = "rgba(0,0,0,0.54)";
  const MIN = 0.05;

  const cropRef = useRef({ cropX, cropY, cropW, cropH });
  cropRef.current = { cropX, cropY, cropW, cropH };

  const activeHandle = useRef<CropHandle>("move");
  const startVals = useRef({ cropX, cropY, cropW, cropH });

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const px = e.nativeEvent.locationX;
      const py = e.nativeEvent.locationY;
      const { cropX: cx, cropY: cy, cropW: cw, cropH: ch } = cropRef.current;
      const L = cx * W; const T = cy * H;
      const R = (cx + cw) * W; const B = (cy + ch) * H;
      const MX = (L + R) / 2; const MY = (T + B) / 2;
      const candidates: { type: CropHandle; x: number; y: number }[] = [
        { type: "tl", x: L, y: T }, { type: "tc", x: MX, y: T }, { type: "tr", x: R, y: T },
        { type: "ml", x: L, y: MY }, { type: "mr", x: R, y: MY },
        { type: "bl", x: L, y: B }, { type: "bc", x: MX, y: B }, { type: "br", x: R, y: B },
      ];
      let nearest: CropHandle = "move";
      let minDist = THRESHOLD;
      for (const c of candidates) {
        const d = Math.sqrt((px - c.x) ** 2 + (py - c.y) ** 2);
        if (d < minDist) { minDist = d; nearest = c.type; }
      }
      activeHandle.current = nearest;
      startVals.current = { ...cropRef.current };
    },
    onPanResponderMove: (_, gs) => {
      const dx = gs.dx / W;
      const dy = gs.dy / H;
      const { cropX: sx, cropY: sy, cropW: sw, cropH: sh } = startVals.current;
      switch (activeHandle.current) {
        case "tl": { const nx = Math.max(0, Math.min(sx + sw - MIN, sx + dx)); const ny = Math.max(0, Math.min(sy + sh - MIN, sy + dy)); onChange(nx, ny, sw + sx - nx, sh + sy - ny); break; }
        case "tc": { const ny = Math.max(0, Math.min(sy + sh - MIN, sy + dy)); onChange(sx, ny, sw, sh + sy - ny); break; }
        case "tr": { const ny = Math.max(0, Math.min(sy + sh - MIN, sy + dy)); onChange(sx, ny, Math.max(MIN, Math.min(1 - sx, sw + dx)), sh + sy - ny); break; }
        case "ml": { const nx = Math.max(0, Math.min(sx + sw - MIN, sx + dx)); onChange(nx, sy, sw + sx - nx, sh); break; }
        case "mr": onChange(sx, sy, Math.max(MIN, Math.min(1 - sx, sw + dx)), sh); break;
        case "bl": { const nx = Math.max(0, Math.min(sx + sw - MIN, sx + dx)); onChange(nx, sy, sw + sx - nx, Math.max(MIN, Math.min(1 - sy, sh + dy))); break; }
        case "bc": onChange(sx, sy, sw, Math.max(MIN, Math.min(1 - sy, sh + dy))); break;
        case "br": onChange(sx, sy, Math.max(MIN, Math.min(1 - sx, sw + dx)), Math.max(MIN, Math.min(1 - sy, sh + dy))); break;
        case "move": onChange(Math.max(0, Math.min(1 - sw, sx + dx)), Math.max(0, Math.min(1 - sh, sy + dy)), sw, sh); break;
      }
    },
  })).current;

  const L = cropX * W; const T = cropY * H;
  const R = (cropX + cropW) * W; const B = (cropY + cropH) * H;
  const MX = (L + R) / 2; const MY = (T + B) / 2;

  const handles: { type: CropHandle; x: number; y: number }[] = [
    { type: "tl", x: L, y: T }, { type: "tc", x: MX, y: T }, { type: "tr", x: R, y: T },
    { type: "ml", x: L, y: MY }, { type: "mr", x: R, y: MY },
    { type: "bl", x: L, y: B }, { type: "bc", x: MX, y: B }, { type: "br", x: R, y: B },
  ];

  return (
    <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: T, backgroundColor: OV }} pointerEvents="none" />
      <View style={{ position: "absolute", top: B, left: 0, right: 0, bottom: 0, backgroundColor: OV }} pointerEvents="none" />
      <View style={{ position: "absolute", top: T, bottom: PREVIEW_H - B, left: 0, width: L, backgroundColor: OV }} pointerEvents="none" />
      <View style={{ position: "absolute", top: T, bottom: PREVIEW_H - B, left: R, right: 0, backgroundColor: OV }} pointerEvents="none" />
      <View style={{ position: "absolute", left: L, top: T, width: R - L, height: B - T, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)" }} pointerEvents="none">
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Rect x={`${100/3}%`} y="0" width="1" height="100%" fill="rgba(255,255,255,0.2)" />
          <Rect x={`${200/3}%`} y="0" width="1" height="100%" fill="rgba(255,255,255,0.2)" />
          <Rect x="0" y={`${100/3}%`} width="100%" height="1" fill="rgba(255,255,255,0.2)" />
          <Rect x="0" y={`${200/3}%`} width="100%" height="1" fill="rgba(255,255,255,0.2)" />
        </Svg>
      </View>
      {handles.map(({ type, x: hx, y: hy }) => (
        <View key={type} pointerEvents="none" style={{ position: "absolute", left: hx - HANDLE / 2, top: hy - HANDLE / 2, width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "rgba(0,0,0,0.4)", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2 }} />
      ))}
    </View>
  );
}

// ─── Graduated Filter Overlay ─────────────────────────────────────────────────
function GraduatedFilterOverlay({ strength, angle }: { strength: number; angle: number }) {
  if (strength === 0) return null;
  const rad = (angle * Math.PI) / 180;
  const cx = SW / 2;
  const cy = PREVIEW_H / 2;
  const len = Math.max(SW, PREVIEW_H);
  const x2 = cx + len * Math.cos(rad);
  const y2 = cy + len * Math.sin(rad);
  const x1 = cx - len * Math.cos(rad);
  const y1 = cy - len * Math.sin(rad);
  const opacity = Math.abs(strength) / 200;
  const color = strength > 0 ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`;
  const gradId = `grad-${angle}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id={gradId} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="50%" stopColor={color} stopOpacity="0.3" />
            <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="6,4" />
      </Svg>
    </View>
  );
}

// ─── Radial Filter Overlay ────────────────────────────────────────────────────
function RadialFilterOverlay({ strength, invert }: { strength: number; invert: boolean }) {
  if (strength === 0) return null;
  const cx = SW / 2;
  const cy = PREVIEW_H / 2;
  const rx = SW * 0.35;
  const ry = PREVIEW_H * 0.35;
  const opacity = Math.abs(strength) / 200;
  const color = strength > 0 ? "white" : "black";
  const gradId = "radial-grad";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={gradId} cx={cx} cy={cy} rx={rx} ry={ry} gradientUnits="userSpaceOnUse">
            {invert ? (
              <>
                <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
                <Stop offset="100%" stopColor={color} stopOpacity="0" />
              </>
            ) : (
              <>
                <Stop offset="0%" stopColor={color} stopOpacity="0" />
                <Stop offset="100%" stopColor={color} stopOpacity={opacity} />
              </>
            )}
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none" strokeDasharray="6,4" />
      </Svg>
    </View>
  );
}

// ─── Rule of Thirds Overlay ──────────────────────────────────────────────────
function RuleOfThirdsOverlay() {
  const lines = [1 / 3, 2 / 3];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        {lines.map((t, i) => (
          <React.Fragment key={i}>
            <Rect x={`${t * 100}%`} y="0" width="1" height="100%" fill="rgba(255,255,255,0.25)" />
            <Rect x="0" y={`${t * 100}%`} width="100%" height="1" fill="rgba(255,255,255,0.25)" />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

// ─── Golden Ratio Overlay ────────────────────────────────────────────────────
function GoldenRatioOverlay() {
  const φ = 1 - 1 / 1.618;
  const lines = [φ, 1 - φ];
  const W = SW;
  const H = PREVIEW_H;
  const goldColor = "rgba(255,215,0,0.35)";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        {lines.map((t, i) => (
          <React.Fragment key={i}>
            <Rect x={t * W} y="0" width="1" height={H} fill={goldColor} />
            <Rect x="0" y={t * H} width={W} height="1" fill={goldColor} />
          </React.Fragment>
        ))}
        <Line x1={lines[0] * W} y1="0" x2="0" y2={lines[1] * H} stroke={goldColor} strokeWidth="1" />
        <Line x1={lines[0] * W} y1={H} x2={W} y2={lines[0] * H} stroke={goldColor} strokeWidth="1" />
      </Svg>
    </View>
  );
}

// ─── Zebra Stripes Overlay ───────────────────────────────────────────────────
function ZebraOverlay({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="zebrap" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect x="0" y="0" width="7" height="14" fill="rgba(255,90,0,0.55)" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#zebrap)" />
      </Svg>
      <View style={st.zebraLabel}>
        <Text style={st.zebraText}>ZEBRA</Text>
      </View>
    </View>
  );
}

// ─── Histogram + Waveform + Vectorscope ──────────────────────────────────────
const HIST_W = 280;
const HIST_H = 56;
const NUM_BINS = 64;

function PhotoHistogram({ uri, mode, onModeChange }: { uri: string; mode: HistMode; onModeChange: (m: HistMode) => void }) {
  const [lumaBars, setLumaBars] = useState<number[]>([]);
  const [rBars, setRBars]   = useState<number[]>([]);
  const [gBars, setGBars]   = useState<number[]>([]);
  const [bBars, setBBars]   = useState<number[]>([]);
  const [wfCols, setWfCols] = useState<Array<{ min: number; max: number; mid: number }>>([]);
  const [vsPoints, setVsPoints] = useState<Array<{ x: number; y: number; a: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS === "web") {
      const doc = globalThis as unknown as { document: Document };
      const winRef = globalThis as unknown as { Image: new () => HTMLImageElement };
      if (!doc.document) return;
      const canvas = doc.document.createElement("canvas");
      canvas.width = 120; canvas.height = 120;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = new winRef.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        try {
          ctx.drawImage(img, 0, 0, 120, 120);
          const { data } = ctx.getImageData(0, 0, 120, 120);
          const luma = new Array<number>(NUM_BINS).fill(0);
          const rh = new Array<number>(NUM_BINS).fill(0);
          const gh = new Array<number>(NUM_BINS).fill(0);
          const bh = new Array<number>(NUM_BINS).fill(0);
          const WFC = 64;
          const wfMin = new Array<number>(WFC).fill(1);
          const wfMax = new Array<number>(WFC).fill(0);
          const wfSum = new Array<number>(WFC).fill(0);
          const wfCnt = new Array<number>(WFC).fill(0);
          const VSG = 60;
          const vsGrid = new Array<number>(VSG * VSG).fill(0);
          for (let py = 0; py < 120; py++) {
            for (let px = 0; px < 120; px++) {
              const idx = (py * 120 + px) * 4;
              const r = data[idx]; const g = data[idx + 1]; const b = data[idx + 2];
              const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              const li = Math.round(L * (NUM_BINS - 1));
              luma[li]++;
              rh[Math.round(r / 255 * (NUM_BINS - 1))]++;
              gh[Math.round(g / 255 * (NUM_BINS - 1))]++;
              bh[Math.round(b / 255 * (NUM_BINS - 1))]++;
              const col = Math.round((px / 119) * (WFC - 1));
              if (L < wfMin[col]) wfMin[col] = L;
              if (L > wfMax[col]) wfMax[col] = L;
              wfSum[col] += L; wfCnt[col]++;
              const Cb = (-0.147 * r - 0.289 * g + 0.436 * b) / 255;
              const Cr = (0.615 * r - 0.515 * g - 0.100 * b) / 255;
              const vx = Math.round((Cb + 0.436) / 0.872 * (VSG - 1));
              const vy = Math.round((Cr + 0.615) / 1.23 * (VSG - 1));
              if (vx >= 0 && vx < VSG && vy >= 0 && vy < VSG) vsGrid[vy * VSG + vx]++;
            }
          }
          const mx = (arr: number[]) => Math.max(...arr) || 1;
          if (!cancelled) {
            setLumaBars(luma.map((v) => v / mx(luma)));
            setRBars(rh.map((v) => v / mx(rh)));
            setGBars(gh.map((v) => v / mx(gh)));
            setBBars(bh.map((v) => v / mx(bh)));
            setWfCols(wfMin.map((_, i) => ({ min: wfMin[i], max: wfMax[i], mid: wfCnt[i] > 0 ? wfSum[i] / wfCnt[i] : 0 })));
            const vsMax = Math.max(...vsGrid, 1);
            const pts: Array<{ x: number; y: number; a: number }> = [];
            vsGrid.forEach((cnt, idx) => {
              if (cnt > 0) { pts.push({ x: (idx % VSG) / (VSG - 1), y: Math.floor(idx / VSG) / (VSG - 1), a: Math.min(1, cnt / vsMax * 4) }); }
            });
            pts.sort((a, b) => b.a - a.a);
            setVsPoints(pts.slice(0, 300));
          }
        } catch {}
      };
      img.onerror = () => {};
      img.src = uri;
    } else {
      const fake = (bias = 0.45) => {
        const a = Array.from({ length: NUM_BINS }, (_, i) => {
          const t = i / (NUM_BINS - 1);
          return Math.max(0, 0.15 + 0.55 * Math.exp(-Math.pow((t - bias) / 0.25, 2))) + Math.random() * 0.1;
        });
        const mx = Math.max(...a);
        return a.map((v) => v / mx);
      };
      setLumaBars(fake(0.45)); setRBars(fake(0.5)); setGBars(fake(0.42)); setBBars(fake(0.4));
      setWfCols(Array.from({ length: 64 }, (_, i) => { const mid = 0.3 + 0.4 * Math.sin(i / 63 * Math.PI); return { min: Math.max(0, mid - 0.2), max: Math.min(1, mid + 0.2), mid }; }));
    }
    return () => { cancelled = true; };
  }, [uri]);

  const bw = HIST_W / NUM_BINS;
  const HIST_MODES: HistMode[] = ["luma", "rgb", "waveform", "vectorscope"];
  const modeLabels: Record<HistMode, string> = { luma: "Luma", rgb: "RGB", waveform: "Wave", vectorscope: "Vector" };

  return (
    <View style={histSt.wrap}>
      <View style={histSt.header}>
        <Text style={histSt.label}>HISTOGRAM</Text>
        <View style={histSt.modeRow}>
          {HIST_MODES.map((m) => (
            <Pressable key={m} onPress={() => onModeChange(m)} style={[histSt.modeBtn, mode === m && histSt.modeBtnActive]}>
              <Text style={[histSt.modeLabel, mode === m && histSt.modeLabelActive]}>{modeLabels[m]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={histSt.svgWrap}>
        {mode === "luma" && (
          <Svg width={HIST_W} height={HIST_H}>
            {lumaBars.map((v, i) => { const h = Math.max(1, v * HIST_H); const t = i / (NUM_BINS - 1); const r = Math.round(60 + t * 195); const g2 = Math.round(120 + t * 100); const b = Math.round(210 - t * 120); return <Rect key={i} x={i * bw} y={HIST_H - h} width={bw - 0.4} height={h} fill={`rgba(${r},${g2},${b},0.9)`} />; })}
          </Svg>
        )}
        {mode === "rgb" && (
          <View style={{ flexDirection: "row", gap: 3 }}>
            {[{ bars: rBars, color: "rgba(255,80,80,0.85)" }, { bars: gBars, color: "rgba(60,200,80,0.85)" }, { bars: bBars, color: "rgba(60,130,255,0.85)" }].map(({ bars: chBars, color }, ci) => {
              const chW = (HIST_W - 6) / 3; const chBw = chW / NUM_BINS;
              return <Svg key={ci} width={chW} height={HIST_H}>{chBars.map((v, i) => { const h = Math.max(1, v * HIST_H); return <Rect key={i} x={i * chBw} y={HIST_H - h} width={Math.max(0.5, chBw - 0.3)} height={h} fill={color} />; })}</Svg>;
            })}
          </View>
        )}
        {mode === "waveform" && (
          <Svg width={HIST_W} height={HIST_H}>
            <Rect x="0" y="0" width={HIST_W} height={HIST_H} fill="rgba(0,0,0,0.3)" />
            {wfCols.map((c, i) => { const colW = HIST_W / wfCols.length; const x = i * colW; const yMin = (1 - c.max) * HIST_H; const yMax = (1 - c.min) * HIST_H; const yMid = (1 - c.mid) * HIST_H; return <React.Fragment key={i}><Rect x={x} y={yMin} width={colW - 0.5} height={Math.max(1, yMax - yMin)} fill="rgba(80,180,255,0.35)" /><Rect x={x} y={yMid - 0.5} width={colW - 0.5} height={1} fill="rgba(120,220,255,0.8)" /></React.Fragment>; })}
            <Line x1="0" y1={HIST_H * 0.5} x2={HIST_W} y2={HIST_H * 0.5} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          </Svg>
        )}
        {mode === "vectorscope" && (
          <Svg width={HIST_H * 2} height={HIST_H * 2}>
            <Circle cx={HIST_H} cy={HIST_H} r={HIST_H - 2} fill="rgba(0,0,0,0.5)" />
            <Circle cx={HIST_H} cy={HIST_H} r={HIST_H - 2} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            {[0, 60, 120, 180, 240, 300].map((deg) => { const rad = (deg * Math.PI) / 180; return <Line key={deg} x1={HIST_H} y1={HIST_H} x2={HIST_H + (HIST_H - 4) * Math.cos(rad)} y2={HIST_H + (HIST_H - 4) * Math.sin(rad)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />; })}
            {vsPoints.map(({ x, y, a }, i) => { const px = 2 + x * (HIST_H * 2 - 4); const py = 2 + y * (HIST_H * 2 - 4); const dx = px - HIST_H; const dy = py - HIST_H; if (dx * dx + dy * dy > (HIST_H - 2) * (HIST_H - 2)) return null; return <Circle key={i} cx={px} cy={py} r={1.5} fill={`rgba(100,220,255,${(a * 0.7).toFixed(2)})`} />; })}
            <Circle cx={HIST_H} cy={HIST_H} r={2} fill="rgba(255,255,255,0.4)" />
          </Svg>
        )}
      </View>
    </View>
  );
}

const histSt = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  label: { color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.6, textTransform: "uppercase" },
  modeRow: { flexDirection: "row", gap: 3 },
  modeBtn: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.06)" },
  modeBtnActive: { backgroundColor: "rgba(255,255,255,0.15)" },
  modeLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "Inter_500Medium" },
  modeLabelActive: { color: "rgba(255,255,255,0.8)" },
  svgWrap: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 6, padding: 4 },
});

// ─── Hue Color Swatch ─────────────────────────────────────────────────────────
function HueSwatch({ hue }: { hue: number }) {
  const h = ((hue % 360) + 360) % 360;
  const c = `hsl(${h}, 80%, 55%)`;
  return (
    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: Platform.OS === "web" ? c : "#888", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }} />
  );
}

function SectionHdr({ title }: { title: string }) {
  return <Text style={st.sectionHdr}>{title}</Text>;
}

function LutSwatch({ id }: { id: string }) {
  const [c1, c2] = LUT_COLORS[id] ?? ["#888", "#888"];
  if (Platform.OS === "web") {
    return <View style={[st.lutSwatchBox, { background: `linear-gradient(135deg, ${c1}, ${c2})` } as object]} />;
  }
  return <View style={[st.lutSwatchBox, { backgroundColor: c1 }]} />;
}

// ─── Retouch Tool Card ────────────────────────────────────────────────────────
function RetouchCard({ icon, label, description, active, onPress }: {
  icon: string; label: string; description: string; active?: boolean; onPress: () => void;
}) {
  const accent = "#0a84ff";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.retouchCard, active && { borderColor: accent, backgroundColor: accent + "18" }, { opacity: pressed ? 0.75 : 1 }]}>
      <Feather name={icon as never} size={22} color={active ? accent : "rgba(255,255,255,0.75)"} />
      <View style={{ flex: 1 }}>
        <Text style={[st.retouchCardLabel, active && { color: accent }]}>{label}</Text>
        <Text style={st.retouchCardDesc} numberOfLines={1}>{description}</Text>
      </View>
      {active && <View style={[st.retouchActiveDot, { backgroundColor: accent }]} />}
    </Pressable>
  );
}

// ─── Edit Screen ─────────────────────────────────────────────────────────────
export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, updatePhoto, loading } = usePhotos();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const photo = photos.find((p) => p.id === id);

  const [adj, setAdj] = useState<PhotoAdjustments>(
    photo?.adjustments ? { ...DEFAULT_ADJUSTMENTS, ...photo.adjustments } : { ...DEFAULT_ADJUSTMENTS }
  );
  const [tab, setTab] = useState<Tab>("adjust");
  const [comparing, setComparing] = useState(false);
  const [histMode, setHistMode] = useState<HistMode>("luma");
  const [showPresets, setShowPresets] = useState(false);
  const [gridMode, setGridMode] = useState<GridMode>("off");
  const [zebraMode, setZebraMode] = useState(false);
  const [curveChannel, setCurveChannel] = useState<CurveChannel>("rgb");
  const [activeRetouchTool, setActiveRetouchTool] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !photo) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
  }, [loading, photo, router]);

  if (loading || !photo) {
    return (
      <View style={[st.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const n = (key: NumKey) => (v: number) => setAdj((a) => ({ ...a, [key]: v }));

  const rotateLeft  = () => setAdj((a) => ({ ...a, rotation: (((a.rotation - 90) % 360 + 360) % 360) as 0 | 90 | 180 | 270 }));
  const rotateRight = () => setAdj((a) => ({ ...a, rotation: ((a.rotation + 90) % 360) as 0 | 90 | 180 | 270 }));
  const toggleFlipH = () => setAdj((a) => ({ ...a, flipH: !a.flipH }));
  const toggleFlipV = () => setAdj((a) => ({ ...a, flipV: !a.flipV }));
  const reset    = () => setAdj({ ...DEFAULT_ADJUSTMENTS });
  const autoTone = () => setAdj((a) => ({ ...a, exposure: 0, brightness: 5, contrast: 12, highlights: -20, shadows: 20, whites: 8, blacks: -8, vibrance: 12, clarity: 8, dehaze: 5 }));
  const aiEnhance = () => setAdj((a) => ({ ...a, exposure: 0, brightness: 8, contrast: 18, highlights: -28, shadows: 30, whites: 12, blacks: -12, vibrance: 18, clarity: 14, dehaze: 8, sharpness: 20, noiseReduction: 15, aiDenoise: 20 }));
  const autoLevel = () => setAdj((a) => ({ ...a, freeRotate: 0 }));
  const autoCrop = () => setAdj((a) => ({ ...a, cropAspect: "4:3", cropX: 0, cropY: 0, cropW: 1, cropH: 1 }));
  const resetCrop = () => setAdj((a) => ({ ...a, cropX: 0, cropY: 0, cropW: 1, cropH: 1 }));

  const applyPreset = (partialAdj: Partial<PhotoAdjustments>) => setAdj({ ...DEFAULT_ADJUSTMENTS, ...partialAdj });
  const setCropAspect = (aspect: string) => {
    if (aspect === "free") {
      setAdj((a) => ({ ...a, cropAspect: "free", cropX: 0, cropY: 0, cropW: 1, cropH: 1 }));
    } else {
      setAdj((a) => ({ ...a, cropAspect: aspect }));
    }
  };
  const setManualCrop = (x: number, y: number, w: number, h: number) => setAdj((a) => ({ ...a, cropX: x, cropY: y, cropW: w, cropH: h, cropAspect: "free" }));
  const setHsl = (hsl: HslAdjustments) => setAdj((a) => ({ ...a, hsl }));
  const setCurvePoints = (pts: CurvePoint[]) => setAdj((a) => ({ ...a, curves: { ...a.curves, [curveChannel]: pts } as CurveSet }));
  const setWBPreset = (warmth: number, tint: number) => setAdj((a) => ({ ...a, warmth, tint }));
  const setLut = (lutName: string) => setAdj((a) => ({ ...a, lutName }));
  const toggleCA = () => setAdj((a) => ({ ...a, chromaticAberration: !a.chromaticAberration }));
  const toggleRadialInvert = () => setAdj((a) => ({ ...a, radialFilterInvert: !a.radialFilterInvert }));

  const setGrading = (region: "shadows" | "midtones" | "highlights", v: WheelValue) => {
    if (region === "shadows") setAdj((a) => ({ ...a, gradingShadowsHue: v.hue, gradingShadowsSat: v.sat, gradingShadowsLum: v.lum }));
    else if (region === "midtones") setAdj((a) => ({ ...a, gradingMidtonesHue: v.hue, gradingMidtonesSat: v.sat, gradingMidtonesLum: v.lum }));
    else setAdj((a) => ({ ...a, gradingHighlightsHue: v.hue, gradingHighlightsSat: v.sat, gradingHighlightsLum: v.lum }));
  };

  const cycleGrid = () => {
    setGridMode((m) => (m === "off" ? "thirds" : m === "thirds" ? "golden" : "off"));
  };

  const handleDone = async () => {
    await updatePhoto(id!, { adjustments: adj });
    if (router.canGoBack()) router.back(); else router.replace("/");
  };
  const handleCancel = () => {
    if (router.canGoBack()) router.back(); else router.replace("/");
  };

  // WB Eye-Dropper (web only — samples canvas pixel)
  const handleEyeDropper = () => {
    if (Platform.OS !== "web") return;
    const doc = globalThis as unknown as { document: Document };
    const winRef = globalThis as unknown as { Image: new () => HTMLImageElement };
    if (!doc.document) return;
    const canvas = doc.document.createElement("canvas");
    canvas.width = 50; canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new winRef.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 20, 20, 10, 10, 0, 0, 50, 50);
      const d = ctx.getImageData(25, 25, 1, 1).data;
      const r = d[0]; const g = d[1]; const b = d[2];
      const warmth = Math.round(((r - b) / 255) * 60);
      const tintVal = Math.round(((g - (r + b) / 2) / 255) * -40);
      setAdj((a) => ({ ...a, warmth, tint: tintVal }));
    };
    img.onerror = () => {};
    img.src = photo.uri;
  };

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 16 : insets.bottom;
  const accent = colors.primary;
  const photoStyle = buildPhotoStyle(adj);

  const TABS: { key: Tab; label: string }[] = [
    { key: "transform", label: "Transform" },
    { key: "adjust",    label: "Adjust" },
    { key: "color",     label: "Color" },
    { key: "detail",    label: "Detail" },
    { key: "curves",    label: "Curves" },
    { key: "filters",   label: "Filters" },
    { key: "retouch",   label: "Retouch" },
    { key: "masks",     label: "Masks" },
  ];

  const CROP_RATIOS = [
    { label: "Free", value: "free" }, { label: "1:1", value: "1:1" }, { label: "4:3", value: "4:3" },
    { label: "3:4", value: "3:4" }, { label: "16:9", value: "16:9" }, { label: "9:16", value: "9:16" },
    { label: "3:2", value: "3:2" }, { label: "2:3", value: "2:3" },
  ];

  const WB_PRESETS = [
    { label: "Auto",       warmth: 0,   tint: 0   },
    { label: "Daylight",   warmth: 5,   tint: 0   },
    { label: "Cloudy",     warmth: 18,  tint: 5   },
    { label: "Shade",      warmth: 32,  tint: 10  },
    { label: "Tungsten",   warmth: -60, tint: 15  },
    { label: "Fluoresc.",  warmth: -20, tint: -30 },
    { label: "Flash",      warmth: 8,   tint: -5  },
  ];

  const curvePoints = adj.curves?.[curveChannel] ?? [{ x: 0, y: 0 }, { x: 1, y: 1 }];

  const gridIconName = gridMode === "off" ? "grid" : gridMode === "thirds" ? "grid" : "maximize-2";
  const gridIconColor = gridMode !== "off" ? "#fff" : "rgba(255,255,255,0.6)";
  const gridBtnBg = gridMode !== "off" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.55)";

  const shadowsVal:    WheelValue = { hue: adj.gradingShadowsHue    ?? 0, sat: adj.gradingShadowsSat    ?? 0, lum: adj.gradingShadowsLum    ?? 0 };
  const midtonesVal:   WheelValue = { hue: adj.gradingMidtonesHue   ?? 0, sat: adj.gradingMidtonesSat   ?? 0, lum: adj.gradingMidtonesLum   ?? 0 };
  const highlightsVal: WheelValue = { hue: adj.gradingHighlightsHue ?? 0, sat: adj.gradingHighlightsSat ?? 0, lum: adj.gradingHighlightsLum ?? 0 };

  const cropX = adj.cropX ?? 0;
  const cropY = adj.cropY ?? 0;
  const cropW = adj.cropW ?? 1;
  const cropH = adj.cropH ?? 1;
  const isManualCrop = adj.cropAspect === "free";
  const hasCropApplied = isManualCrop && (cropX > 0 || cropY > 0 || cropW < 1 || cropH < 1);

  const RETOUCH_TOOLS = [
    { id: "remove",    icon: "scissors",    label: "Remove Tool",         description: "Sample & fill unwanted areas" },
    { id: "healing",   icon: "crosshair",   label: "Spot Healing Brush",  description: "Auto-blend surrounding texture" },
    { id: "patch",     icon: "square",      label: "Patch Tool",          description: "Drag selection to source area" },
    { id: "clone",     icon: "copy",        label: "Clone Stamp",         description: "Paint exact sample from source" },
    { id: "redeye",    icon: "eye",         label: "Red-Eye Reduction",   description: "Detect & remove red-eye flash" },
    { id: "genfill",   icon: "cpu",         label: "Generative Fill",     description: "AI-powered text-to-image fill" },
    { id: "outpaint",  icon: "maximize",    label: "Generative Expand",   description: "Extend canvas with AI content" },
  ];

  return (
    <View style={[st.root, { paddingTop: topInset }]}>
      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable onPress={handleCancel} style={({ pressed }) => [st.hdrBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={10}>
          <Text style={st.cancel}>Cancel</Text>
        </Pressable>
        <Text style={st.title}>Edit Photo</Text>
        <Pressable onPress={handleDone} style={({ pressed }) => [st.hdrBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={10}>
          <Text style={[st.done, { color: accent }]}>Done</Text>
        </Pressable>
      </View>

      {/* ── Photo Preview ── */}
      <View style={[st.preview, { height: PREVIEW_H }]}>
        <View style={[{ flex: 1, overflow: "hidden" }, comparing ? {} : (photoStyle as object)]}>
          <Image source={{ uri: photo.uri }} style={{ width: SW, height: PREVIEW_H }} contentFit="contain" />
          {!comparing && <VignetteOverlay amount={adj.vignette} />}
          {!comparing && <GrainOverlay amount={adj.grain} />}
          {!comparing && adj.cropAspect !== "free" && <CropOverlay aspect={adj.cropAspect ?? "free"} />}
          {!comparing && gridMode === "thirds" && <RuleOfThirdsOverlay />}
          {!comparing && gridMode === "golden" && <GoldenRatioOverlay />}
          {!comparing && <ZebraOverlay enabled={zebraMode} />}
          {!comparing && tab === "filters" && <GraduatedFilterOverlay strength={adj.graduatedFilterStrength ?? 0} angle={adj.graduatedFilterAngle ?? 0} />}
          {!comparing && tab === "filters" && <RadialFilterOverlay strength={adj.radialFilterStrength ?? 0} invert={adj.radialFilterInvert ?? false} />}
        </View>

        {/* Manual crop overlay (interactive) */}
        {!comparing && tab === "transform" && isManualCrop && (
          <ManualCropOverlay
            cropX={cropX} cropY={cropY} cropW={cropW} cropH={cropH}
            onChange={setManualCrop}
          />
        )}

        <Pressable
          onPressIn={() => setComparing(true)}
          onPressOut={() => setComparing(false)}
          style={st.compareBtn}
          hitSlop={8}
        >
          <Feather name={comparing ? "eye-off" : "eye"} size={15} color="rgba(255,255,255,0.85)" />
          <Text style={st.compareTxt}>{comparing ? "Original" : "Compare"}</Text>
        </Pressable>

        {tab === "transform" && (
          <View style={st.previewBtnsRight}>
            <Pressable onPress={cycleGrid} style={[st.gridBtn, { backgroundColor: gridBtnBg }]}>
              <Feather name={gridIconName} size={15} color={gridIconColor} />
              {gridMode !== "off" && (
                <Text style={st.gridBtnLabel}>{gridMode === "thirds" ? "1/3" : "φ"}</Text>
              )}
            </Pressable>
          </View>
        )}
        {tab === "detail" && (
          <Pressable
            onPress={() => setZebraMode((v) => !v)}
            style={[st.gridBtn, { bottom: 10, right: 12, position: "absolute", backgroundColor: zebraMode ? "rgba(255,90,0,0.6)" : "rgba(0,0,0,0.55)" }]}
          >
            <Text style={[st.gridBtnLabel, { color: "#fff" }]}>ZEBRA</Text>
          </Pressable>
        )}
      </View>

      {/* ── Histogram ── */}
      <PhotoHistogram uri={photo.uri} mode={histMode} onModeChange={setHistMode} />

      {/* ── Quick Actions ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.quickActions}>
        <Pressable onPress={autoTone} style={({ pressed }) => [st.quickBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="zap" size={13} color={accent} />
          <Text style={[st.quickLabel, { color: accent }]}>Auto Tone</Text>
        </Pressable>
        <Pressable onPress={aiEnhance} style={({ pressed }) => [st.quickBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="cpu" size={13} color="#a78bfa" />
          <Text style={[st.quickLabel, { color: "#a78bfa" }]}>AI Enhance</Text>
        </Pressable>
        <Pressable onPress={autoCrop} style={({ pressed }) => [st.quickBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="crop" size={13} color="#34d399" />
          <Text style={[st.quickLabel, { color: "#34d399" }]}>Auto-Crop</Text>
        </Pressable>
        <Pressable onPress={() => setShowPresets(true)} style={({ pressed }) => [st.quickBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="layers" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={st.quickLabel}>Presets</Text>
        </Pressable>
        <Pressable onPress={reset} style={({ pressed }) => [st.quickBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="refresh-ccw" size={13} color="rgba(255,255,255,0.5)" />
          <Text style={[st.quickLabel, { color: "rgba(255,255,255,0.5)" }]}>Reset</Text>
        </Pressable>
      </ScrollView>

      {/* ── Tab Bar ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabScroll} contentContainerStyle={st.tabs}>
        {TABS.map(({ key, label }) => (
          <Pressable key={key} onPress={() => setTab(key)} style={st.tabItem}>
            <Text style={[st.tabLabel, tab === key ? { color: accent, fontFamily: "Inter_600SemiBold" } : { color: "rgba(255,255,255,0.45)" }]}>
              {label}
            </Text>
            {tab === key && <View style={[st.tabLine, { backgroundColor: accent }]} />}
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Controls ── */}
      <ScrollView style={st.controls} contentContainerStyle={[st.controlsInner, { paddingBottom: bottomInset + 20 }]} showsVerticalScrollIndicator={false}>

        {/* ── Transform ── */}
        {tab === "transform" && (
          <View style={st.sliders}>
            <SectionHdr title="Rotate & Flip" />
            <View style={st.xformGrid}>
              {[
                { icon: "rotate-ccw" as const, label: "Rotate Left", onPress: rotateLeft },
                { icon: "rotate-cw" as const, label: "Rotate Right", onPress: rotateRight },
              ].map(({ icon, label, onPress }) => (
                <Pressable key={label} onPress={onPress} style={({ pressed }) => [st.xformBtn, { opacity: pressed ? 0.7 : 1 }]}>
                  <Feather name={icon} size={26} color="#fff" />
                  <Text style={st.xformLbl}>{label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={toggleFlipH} style={({ pressed }) => [st.xformBtn, { opacity: pressed ? 0.7 : 1, borderColor: adj.flipH ? accent : "rgba(255,255,255,0.12)" }]}>
                <Feather name="minimize-2" size={26} color={adj.flipH ? accent : "#fff"} />
                <Text style={[st.xformLbl, { color: adj.flipH ? accent : "#fff" }]}>Flip H</Text>
              </Pressable>
              <Pressable onPress={toggleFlipV} style={({ pressed }) => [st.xformBtn, { opacity: pressed ? 0.7 : 1, borderColor: adj.flipV ? accent : "rgba(255,255,255,0.12)" }]}>
                <View style={{ transform: [{ rotate: "90deg" }] }}>
                  <Feather name="minimize-2" size={26} color={adj.flipV ? accent : "#fff"} />
                </View>
                <Text style={[st.xformLbl, { color: adj.flipV ? accent : "#fff" }]}>Flip V</Text>
              </Pressable>
            </View>

            <SectionHdr title="Straighten" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <EditSlider label="Free Rotate" value={adj.freeRotate ?? 0} min={-45} max={45} onValueChange={n("freeRotate")} accent={accent} unit="°" />
              </View>
              <Pressable onPress={autoLevel} style={({ pressed }) => [st.levelBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <Feather name="minus" size={14} color="#fff" />
                <Text style={st.levelBtnLabel}>Level</Text>
              </Pressable>
            </View>

            <SectionHdr title="Crop" />
            <Text style={st.infoText}>Tap Free to enable drag handles on the preview. Drag corners and edges to crop.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {CROP_RATIOS.map(({ label, value }) => (
                <Pressable key={value} onPress={() => setCropAspect(value)} style={[st.cropBtn, (adj.cropAspect ?? "free") === value && { borderColor: accent, backgroundColor: accent + "22" }]}>
                  <Text style={[st.cropLabel, (adj.cropAspect ?? "free") === value && { color: accent }]}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {isManualCrop && hasCropApplied && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Text style={[st.infoText, { flex: 1 }]}>
                  Crop: {Math.round(cropX * 100)}%, {Math.round(cropY * 100)}% — {Math.round(cropW * 100)}×{Math.round(cropH * 100)}
                </Text>
                <Pressable onPress={resetCrop} style={st.smallBtn}>
                  <Text style={st.smallBtnLabel}>Reset Crop</Text>
                </Pressable>
              </View>
            )}

            <SectionHdr title="Perspective Correction (Keystone)" />
            <EditSlider label="Vertical Keystone" value={adj.perspectiveV ?? 0} min={-50} max={50} onValueChange={n("perspectiveV")} accent={accent} />
            <EditSlider label="Horizontal Keystone" value={adj.perspectiveH ?? 0} min={-50} max={50} onValueChange={n("perspectiveH")} accent={accent} />

            <SectionHdr title="Lens Correction" />
            <EditSlider label="Distortion" value={adj.lensDistortion ?? 0} min={-100} max={100} onValueChange={n("lensDistortion")} accent="#fb923c" />
            <EditSlider label="Defringe" value={adj.defringe ?? 0} min={0} max={100} onValueChange={n("defringe")} accent="#c084fc" />
            <View style={st.toggleRow}>
              <Text style={st.toggleLabel}>Chromatic Aberration Removal</Text>
              <Pressable
                onPress={toggleCA}
                style={[st.toggleBtn, adj.chromaticAberration && { backgroundColor: accent }]}
              >
                <Text style={[st.toggleBtnLabel, adj.chromaticAberration && { color: "#fff" }]}>
                  {adj.chromaticAberration ? "On" : "Off"}
                </Text>
              </Pressable>
            </View>

            <SectionHdr title="Resize & Scale" />
            <View style={st.infoCard}>
              <View style={st.infoCardRow}>
                <Text style={st.infoCardLabel}>Original Size</Text>
                <Text style={st.infoCardValue}>{photo.width ?? "—"} × {photo.height ?? "—"} px</Text>
              </View>
              <View style={[st.infoCardRow, { marginTop: 6 }]}>
                <Text style={st.infoCardLabel}>Export Options</Text>
                <Text style={st.infoCardValue}>Full · 2× · 1× · Web</Text>
              </View>
              <Text style={[st.infoText, { marginTop: 6 }]}>
                Use the share button in photo view to export at different scales.
              </Text>
            </View>
          </View>
        )}

        {/* ── Adjust ── */}
        {tab === "adjust" && (
          <View style={st.sliders}>
            <SectionHdr title="Exposure" />
            <EditSlider label="Exposure" value={adj.exposure ?? 0} onValueChange={n("exposure")} accent="#ffe08a" />

            <SectionHdr title="Light" />
            <EditSlider label="Brightness" value={adj.brightness} onValueChange={n("brightness")} accent={accent} />
            <EditSlider label="Contrast"   value={adj.contrast}   onValueChange={n("contrast")}   accent={accent} />

            <SectionHdr title="Tone" />
            <EditSlider label="Highlights"   value={adj.highlights}           onValueChange={n("highlights")}   accent={accent} />
            <EditSlider label="Shadows"      value={adj.shadows}              onValueChange={n("shadows")}      accent={accent} />
            <EditSlider label="Whites"       value={adj.whites}               onValueChange={n("whites")}       accent={accent} />
            <EditSlider label="Blacks"       value={adj.blacks}               onValueChange={n("blacks")}       accent={accent} />
            <EditSlider label="Tone Mapping" value={adj.toneMapping ?? 0}     onValueChange={n("toneMapping")}  accent={accent} />

            <SectionHdr title="Levels" />
            <EditSlider label="Black Point"      value={adj.levelsBlack    ?? 0} min={0}    max={100}  onValueChange={n("levelsBlack")}    accent="#aaa" />
            <EditSlider label="Midtone (Gamma)"  value={adj.levelsMidtone  ?? 0}            onValueChange={n("levelsMidtone")}  accent={accent} />
            <EditSlider label="White Point"      value={adj.levelsWhite    ?? 0} min={-100} max={0}    onValueChange={n("levelsWhite")}    accent="#eee" />
            <EditSlider label="Output Black"     value={adj.levelsOutBlack ?? 0} min={0}    max={50}   onValueChange={n("levelsOutBlack")} accent="#666" />
            <EditSlider label="Output White"     value={adj.levelsOutWhite ?? 0} min={-50}  max={0}    onValueChange={n("levelsOutWhite")} accent="#ccc" />

            <SectionHdr title="Effects" />
            <EditSlider label="Vignette" value={adj.vignette} onValueChange={n("vignette")} accent={accent} />
          </View>
        )}

        {/* ── Color ── */}
        {tab === "color" && (
          <View style={st.sliders}>
            <SectionHdr title="Color" />
            <EditSlider label="Saturation" value={adj.saturation} onValueChange={n("saturation")} accent={accent} />
            <EditSlider label="Vibrance"   value={adj.vibrance}   onValueChange={n("vibrance")}   accent={accent} />
            <EditSlider label="Hue"        value={adj.hue ?? 0}   min={-180} max={180} onValueChange={n("hue")} accent="#a78bfa" unit="°" />

            <SectionHdr title="White Balance" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 6 }}>
              {WB_PRESETS.map((p) => {
                const active = adj.warmth === p.warmth && adj.tint === p.tint;
                return (
                  <Pressable key={p.label} onPress={() => setWBPreset(p.warmth, p.tint)} style={[st.wbBtn, active && { borderColor: "#f5a623", backgroundColor: "#f5a62322" }]}>
                    <Text style={[st.wbLabel, active && { color: "#f5a623" }]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <EditSlider label="Warmth (Temperature)" value={adj.warmth} onValueChange={n("warmth")} accent="#f5a623" />
            <EditSlider label="Tint"   value={adj.tint}   onValueChange={n("tint")}   accent="#30d158" />
            {Platform.OS === "web" && (
              <Pressable onPress={handleEyeDropper} style={({ pressed }) => [st.eyedropperBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <Feather name="target" size={16} color="#f5a623" />
                <Text style={st.eyedropperLabel}>Eye-Dropper: Sample neutral gray from center</Text>
              </Pressable>
            )}

            <SectionHdr title="Film Emulation (LUTs)" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {LUT_LIST.map(({ id: lid, name }) => {
                const active = (adj.lutName ?? "none") === lid;
                return (
                  <Pressable key={lid} onPress={() => setLut(lid)} style={[st.lutBtn, active && { borderColor: accent, backgroundColor: accent + "22" }]}>
                    <LutSwatch id={lid} />
                    <Text style={[st.lutLabel, active && { color: accent }]}>{name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <SectionHdr title="HSL (Color Mixer)" />
            <HSLPanel hsl={adj.hsl ?? DEFAULT_ADJUSTMENTS.hsl} onChange={setHsl} />

            <SectionHdr title="Color Grading" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 8, paddingHorizontal: 4 }}>
              <ColorGradingWheel label="Shadows"    value={shadowsVal}    onChange={(v) => setGrading("shadows", v)} />
              <ColorGradingWheel label="Midtones"   value={midtonesVal}   onChange={(v) => setGrading("midtones", v)} />
              <ColorGradingWheel label="Highlights" value={highlightsVal} onChange={(v) => setGrading("highlights", v)} />
            </ScrollView>

            <SectionHdr title="Split Toning" />
            <Text style={st.subLabel}>Highlights</Text>
            <View style={st.splitRow}>
              <HueSwatch hue={adj.splitHighlightsHue ?? 0} />
              <View style={{ flex: 1 }}>
                <EditSlider label="Hue" value={adj.splitHighlightsHue ?? 0} min={0} max={360} onValueChange={n("splitHighlightsHue")} accent="#ffe08a" unit="°" />
              </View>
            </View>
            <EditSlider label="Saturation" value={adj.splitHighlightsSat ?? 0} min={0} max={100} onValueChange={n("splitHighlightsSat")} accent="#ffe08a" />
            <Text style={st.subLabel}>Shadows</Text>
            <View style={st.splitRow}>
              <HueSwatch hue={adj.splitShadowsHue ?? 0} />
              <View style={{ flex: 1 }}>
                <EditSlider label="Hue" value={adj.splitShadowsHue ?? 0} min={0} max={360} onValueChange={n("splitShadowsHue")} accent="#60a5fa" unit="°" />
              </View>
            </View>
            <EditSlider label="Saturation" value={adj.splitShadowsSat ?? 0} min={0} max={100} onValueChange={n("splitShadowsSat")} accent="#60a5fa" />

            <SectionHdr title="Color Replacement" />
            <Text style={st.infoText}>Target a hue and shift it to a new color.</Text>
            <View style={st.splitRow}>
              <HueSwatch hue={adj.colorReplaceTargetHue ?? 0} />
              <View style={{ flex: 1 }}>
                <EditSlider label="Target Hue" value={adj.colorReplaceTargetHue ?? 0} min={0} max={360} onValueChange={n("colorReplaceTargetHue")} accent="#f87171" unit="°" />
              </View>
            </View>
            <EditSlider label="Range" value={adj.colorReplaceRange ?? 30} min={5} max={90} onValueChange={n("colorReplaceRange")} accent="#f87171" />
            <View style={st.splitRow}>
              <HueSwatch hue={adj.colorReplaceHue ?? 0} />
              <View style={{ flex: 1 }}>
                <EditSlider label="Replace Hue" value={adj.colorReplaceHue ?? 0} min={0} max={360} onValueChange={n("colorReplaceHue")} accent="#86efac" unit="°" />
              </View>
            </View>
            <EditSlider label="Replace Saturation" value={adj.colorReplaceSat ?? 0} min={-100} max={100} onValueChange={n("colorReplaceSat")} accent="#86efac" />
          </View>
        )}

        {/* ── Detail ── */}
        {tab === "detail" && (
          <View style={st.sliders}>
            <SectionHdr title="Sharpening" />
            <EditSlider label="Amount"  value={adj.sharpness}              min={0} max={100} onValueChange={n("sharpness")}          accent={accent} />
            <EditSlider label="Radius"  value={adj.sharpeningRadius  ?? 25} min={0} max={100} onValueChange={n("sharpeningRadius")}   accent={accent} />
            <EditSlider label="Detail / Masking" value={adj.sharpeningMasking ?? 0}  min={0} max={100} onValueChange={n("sharpeningMasking")}  accent={accent} />

            <SectionHdr title="Clarity & Structure" />
            <EditSlider label="Clarity"  value={adj.clarity}       onValueChange={n("clarity")}  accent={accent} />
            <EditSlider label="Texture"  value={adj.texture ?? 0}  onValueChange={n("texture")}  accent={accent} />
            <EditSlider label="Dehaze"   value={adj.dehaze}        onValueChange={n("dehaze")}   accent={accent} />

            <SectionHdr title="Noise Reduction" />
            <EditSlider label="Luminance Noise"  value={adj.noiseReduction}    min={0} max={100} onValueChange={n("noiseReduction")} accent={accent} />
            <EditSlider label="Color Noise"      value={adj.colorNoise ?? 0}   min={0} max={100} onValueChange={n("colorNoise")}    accent={accent} />
            <EditSlider label="AI Denoise"       value={adj.aiDenoise ?? 0}    min={0} max={100} onValueChange={n("aiDenoise")}     accent="#a78bfa" />
            <View style={[st.infoCard, { marginTop: 4 }]}>
              <Text style={st.infoText}>AI Denoise uses advanced noise modeling to remove grain while preserving fine edge detail.</Text>
            </View>

            <SectionHdr title="AI Portrait (Skin Smoothing)" />
            <EditSlider label="Skin Smoothing" value={adj.skinSmoothing ?? 0} min={0} max={100} onValueChange={n("skinSmoothing")} accent="#f9a8d4" />
            <Text style={[st.infoText, { marginTop: 2 }]}>Selectively smooths skin tones while preserving non-skin areas.</Text>

            <SectionHdr title="Film Grain" />
            <EditSlider label="Amount" value={adj.grain} min={0} max={100} onValueChange={n("grain")} accent={accent} />

            <View style={st.zebraHint}>
              <Feather name="alert-triangle" size={12} color="rgba(255,150,0,0.7)" />
              <Text style={st.zebraHintText}>Tap ZEBRA on the preview to toggle overexposure warning</Text>
            </View>
          </View>
        )}

        {/* ── Curves ── */}
        {tab === "curves" && (
          <View style={st.sliders}>
            <Text style={st.curvesHint}>
              Drag points to reshape the tone curve. Tap empty space to add a point. Tap a point to remove it.
            </Text>
            <CurveEditor
              points={curvePoints}
              onChange={setCurvePoints}
              channel={curveChannel}
              onChannelChange={setCurveChannel}
              accent={accent}
            />
          </View>
        )}

        {/* ── Filters (Graduated + Radial) ── */}
        {tab === "filters" && (
          <View style={st.sliders}>
            <SectionHdr title="Digital Graduated Filter" />
            <Text style={st.infoText}>Simulates a graduated ND filter. Positive strength brightens, negative darkens.</Text>
            <EditSlider label="Strength"  value={adj.graduatedFilterStrength ?? 0} min={-100} max={100} onValueChange={n("graduatedFilterStrength")} accent="#93c5fd" />
            <EditSlider label="Angle"     value={adj.graduatedFilterAngle ?? 0}    min={-180} max={180} onValueChange={n("graduatedFilterAngle")}    accent="#93c5fd" unit="°" />
            <EditSlider label="Feather"   value={adj.graduatedFilterFeather ?? 50} min={0}    max={100} onValueChange={n("graduatedFilterFeather")}   accent="#93c5fd" />
            <View style={[st.infoCard, { marginTop: 4 }]}>
              <Text style={st.infoText}>The dashed line on the preview shows the gradient direction.</Text>
            </View>

            <SectionHdr title="Radial / Circular Filter" />
            <Text style={st.infoText}>Apply adjustments inside or outside an ellipse. Use with Invert to create a spotlight.</Text>
            <EditSlider label="Strength" value={adj.radialFilterStrength ?? 0} min={-100} max={100} onValueChange={n("radialFilterStrength")} accent="#fca5a5" />
            <EditSlider label="Feather"  value={adj.radialFilterFeather ?? 50} min={0}    max={100} onValueChange={n("radialFilterFeather")}  accent="#fca5a5" />
            <View style={st.toggleRow}>
              <Text style={st.toggleLabel}>Invert (apply inside ellipse)</Text>
              <Pressable
                onPress={toggleRadialInvert}
                style={[st.toggleBtn, adj.radialFilterInvert && { backgroundColor: "#fca5a5" }]}
              >
                <Text style={[st.toggleBtnLabel, adj.radialFilterInvert && { color: "#111" }]}>
                  {adj.radialFilterInvert ? "On" : "Off"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Retouch ── */}
        {tab === "retouch" && (
          <View style={st.sliders}>
            <SectionHdr title="Retouching Tools" />
            <Text style={st.infoText}>Select a tool, then tap the preview to apply. Tools work best on uniform backgrounds.</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {RETOUCH_TOOLS.map(({ id: tid, icon, label, description }) => (
                <RetouchCard
                  key={tid}
                  icon={icon}
                  label={label}
                  description={description}
                  active={activeRetouchTool === tid}
                  onPress={() => setActiveRetouchTool((prev) => prev === tid ? null : tid)}
                />
              ))}
            </View>
            {activeRetouchTool && (
              <View style={[st.infoCard, { marginTop: 8 }]}>
                <Feather name="info" size={13} color="rgba(255,255,255,0.4)" />
                <Text style={[st.infoText, { flex: 1 }]}>
                  {activeRetouchTool === "redeye" && "Tap on red eyes in the preview to automatically correct them."}
                  {activeRetouchTool === "remove" && "Draw over the area to remove. The tool will sample surrounding pixels."}
                  {activeRetouchTool === "healing" && "Brush over blemishes. The tool blends surrounding texture seamlessly."}
                  {activeRetouchTool === "patch" && "Draw a selection around the target, then drag to a clean source area."}
                  {activeRetouchTool === "clone" && "Option-click to set source, then paint to clone that area."}
                  {activeRetouchTool === "genfill" && "Select an area and describe what to replace it with using AI."}
                  {activeRetouchTool === "outpaint" && "Expand the canvas boundary and AI will fill in the new space."}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Masks ── */}
        {tab === "masks" && (
          <View style={st.sliders}>
            <SectionHdr title="Brush Mask" />
            <Text style={st.infoText}>Paint to reveal or hide where adjustments apply. White = reveal, Black = hide.</Text>
            <EditSlider label="Brush Strength" value={adj.maskBrushStrength ?? 0} min={0} max={100} onValueChange={n("maskBrushStrength")} accent="#e2e8f0" />

            <SectionHdr title="Linear Gradient Mask" />
            <Text style={st.infoText}>Fade adjustments along a linear gradient for smooth sky-to-ground transitions.</Text>
            <EditSlider label="Gradient Strength" value={adj.maskGradientStrength ?? 0} min={-100} max={100} onValueChange={n("maskGradientStrength")} accent="#7dd3fc" />

            <SectionHdr title="Radial Gradient Mask" />
            <Text style={st.infoText}>Apply adjustments inside or outside an elliptical region — ideal for spotlighting subjects.</Text>
            <EditSlider label="Radial Strength" value={adj.maskRadialStrength ?? 0} min={-100} max={100} onValueChange={n("maskRadialStrength")} accent="#86efac" />

            <SectionHdr title="Luminosity Mask" />
            <Text style={st.infoText}>Target adjustments to specific brightness ranges. Low = shadows only, High = highlights only.</Text>
            <EditSlider label="Shadow Threshold"    value={adj.maskLuminosityLow  ?? 0}   min={0} max={100} onValueChange={n("maskLuminosityLow")}  accent="#94a3b8" />
            <EditSlider label="Highlight Threshold" value={adj.maskLuminosityHigh ?? 100} min={0} max={100} onValueChange={n("maskLuminosityHigh")} accent="#f1f5f9" />

            <SectionHdr title="Color / Hue Mask" />
            <Text style={st.infoText}>Target a specific color range — useful for isolating sky, foliage, or skin tones.</Text>
            <View style={st.splitRow}>
              <HueSwatch hue={adj.colorReplaceTargetHue ?? 0} />
              <View style={{ flex: 1 }}>
                <EditSlider label="Target Hue" value={adj.colorReplaceTargetHue ?? 0} min={0} max={360} onValueChange={n("colorReplaceTargetHue")} accent="#f87171" unit="°" />
              </View>
            </View>
            <EditSlider label="Hue Range" value={adj.colorReplaceRange ?? 30} min={5} max={90} onValueChange={n("colorReplaceRange")} accent="#f87171" />

            <SectionHdr title="MaskAI" />
            <View style={[st.infoCard, { flexDirection: "row", gap: 10, alignItems: "center" }]}>
              <Feather name="cpu" size={20} color="#a78bfa" />
              <View style={{ flex: 1 }}>
                <Text style={[st.infoText, { color: "#a78bfa", fontFamily: "Inter_600SemiBold" }]}>AI Subject Mask</Text>
                <Text style={st.infoText}>One-click AI detection of subjects (people, animals, objects) for precise masking.</Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Presets Modal ── */}
      <PresetsPanel visible={showPresets} onClose={() => setShowPresets(false)} current={adj} onApply={applyPreset} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  hdrBtn: { minWidth: 60 },
  cancel: { color: "rgba(255,255,255,0.65)", fontSize: 16, fontFamily: "Inter_400Regular" },
  title:  { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  done:   { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  preview: { position: "relative", backgroundColor: "#000" },
  compareBtn: { position: "absolute", bottom: 10, left: 12, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  compareTxt: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_500Medium" },
  previewBtnsRight: { position: "absolute", bottom: 10, right: 12, flexDirection: "row", gap: 6 },
  gridBtn: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 3 },
  gridBtnLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  zebraLabel: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(255,90,0,0.75)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  zebraText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  quickActions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  quickBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8 },
  quickLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium" },
  tabScroll: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  tabs: { flexDirection: "row", paddingHorizontal: 8 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", position: "relative" },
  tabLabel: { fontSize: 13, letterSpacing: 0.2 },
  tabLine: { position: "absolute", bottom: 0, left: 10, right: 10, height: 2, borderRadius: 1 },
  controls: { flex: 1 },
  controlsInner: { paddingTop: 10, gap: 0 },
  sliders: { paddingHorizontal: 16, gap: 8 },
  sectionHdr: { color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 10, marginBottom: 2 },
  subLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 6, marginBottom: 2 },
  xformGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 4 },
  xformBtn: { flex: 1, minWidth: "45%", alignItems: "center", justifyContent: "center", paddingVertical: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  xformLbl: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  levelBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  levelBtnLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium" },
  cropBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  cropLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium" },
  wbBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  wbLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium" },
  lutBtn: { alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", minWidth: 66 },
  lutSwatchBox: { width: 40, height: 26, borderRadius: 6 },
  lutLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "Inter_500Medium" },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  curvesHint: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 4 },
  zebraHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingHorizontal: 4 },
  zebraHintText: { color: "rgba(255,150,0,0.7)", fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  toggleLabel: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  toggleBtnLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  infoText: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  infoCard: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, gap: 4, flexDirection: "row", flexWrap: "wrap" },
  infoCardRow: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  infoCardLabel: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_500Medium" },
  infoCardValue: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium" },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  smallBtnLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_500Medium" },
  eyedropperBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(245,166,35,0.1)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(245,166,35,0.3)" },
  eyedropperLabel: { color: "#f5a623", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  retouchCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  retouchCardLabel: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  retouchCardDesc: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  retouchActiveDot: { width: 8, height: 8, borderRadius: 4 },
});
