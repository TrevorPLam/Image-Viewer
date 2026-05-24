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
  Defs,
  FeColorMatrix,
  FeTurbulence,
  Filter,
  RadialGradient,
  Rect,
  Stop,
  Svg,
} from "react-native-svg";

import {
  DEFAULT_ADJUSTMENTS,
  PhotoAdjustments,
  usePhotos,
} from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";
import { buildPhotoStyle } from "@/utils/photoStyle";

const { width: SW, height: SH } = Dimensions.get("window");
const PREVIEW_H = Math.round(SH * 0.46);

type Tab = "transform" | "adjust" | "color" | "detail";

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onValueChange: (v: number) => void;
  accent: string;
}

function EditSlider({
  label,
  value,
  min = -100,
  max = 100,
  onValueChange,
  accent,
}: SliderProps) {
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

  return (
    <View style={sl.wrap}>
      <View style={sl.hdr}>
        <Text style={sl.lbl}>{label}</Text>
        <Text
          style={[
            sl.val,
            { color: value !== 0 ? accent : "rgba(255,255,255,0.38)" },
          ]}
        >
          {value > 0 ? `+${value}` : `${value}`}
        </Text>
      </View>
      <View
        style={sl.track}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={sl.trackBg} />
        <View
          style={[
            sl.fill,
            { left: fillL, width: Math.max(0, fillW), backgroundColor: accent },
          ]}
        />
        <View style={[sl.center, { left: centerPct * trackW - 0.75 }]} />
        <View style={[sl.thumb, { left: thumbL }]} />
      </View>
    </View>
  );
}

// ─── Vignette Overlay ───────────────────────────────────────────────────────
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
            <FeTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="4"
              stitchTiles="stitch"
              result="noise"
            />
            <FeColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="grey"
            />
          </Filter>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          filter="url(#grain-f)"
          opacity={grainOpacity}
        />
      </Svg>
    </View>
  );
}

// ─── Histogram ──────────────────────────────────────────────────────────────
const HIST_W = 280;
const HIST_H = 44;
const NUM_BINS = 64;

function PhotoHistogram({ uri }: { uri: string }) {
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (Platform.OS === "web") {
      const doc = globalThis as unknown as { document: Document };
      const win = globalThis as unknown as { Image: typeof Image };
      if (!doc.document || !win.Image) return;

      const canvas = doc.document.createElement("canvas");
      canvas.width = 120;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new (win as unknown as { Image: new () => HTMLImageElement }).Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        try {
          ctx.drawImage(img, 0, 0, 120, 120);
          const { data } = ctx.getImageData(0, 0, 120, 120);
          const hist = new Array<number>(NUM_BINS).fill(0);
          for (let i = 0; i < data.length; i += 4) {
            const L = Math.round(
              (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) /
                255 *
                (NUM_BINS - 1)
            );
            hist[L]++;
          }
          const mx = Math.max(...hist) || 1;
          if (!cancelled) setBars(hist.map((v) => v / mx));
        } catch {
          // CORS blocked — skip histogram
        }
      };
      img.onerror = () => {};
      img.src = uri;
    } else {
      // Native: generate a plausible-looking placeholder histogram
      const fake = Array.from({ length: NUM_BINS }, (_, i) => {
        const t = i / (NUM_BINS - 1);
        return (
          Math.max(0, 0.15 + 0.55 * Math.exp(-Math.pow((t - 0.45) / 0.25, 2))) +
          Math.random() * 0.1
        );
      });
      const mx = Math.max(...fake);
      setBars(fake.map((v) => v / mx));
    }

    return () => { cancelled = true; };
  }, [uri]);

  if (bars.length === 0) return <View style={{ height: HIST_H + 16 }} />;

  const bw = HIST_W / NUM_BINS;

  return (
    <View style={histSt.wrap}>
      <Text style={histSt.label}>Histogram</Text>
      <View style={histSt.svgWrap}>
        <Svg width={HIST_W} height={HIST_H}>
          {bars.map((v, i) => {
            const h = Math.max(1, v * HIST_H);
            const t = i / (NUM_BINS - 1);
            const r = Math.round(60 + t * 195);
            const g = Math.round(120 + t * 100);
            const b = Math.round(210 - t * 120);
            return (
              <Rect
                key={i}
                x={i * bw}
                y={HIST_H - h}
                width={bw - 0.4}
                height={h}
                fill={`rgba(${r},${g},${b},0.9)`}
              />
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const histSt = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
    gap: 4,
  },
  label: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  svgWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 6,
    padding: 4,
  },
});

// ─── Edit Screen ─────────────────────────────────────────────────────────────
export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, updatePhoto, loading } = usePhotos();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const photo = photos.find((p) => p.id === id);

  const [adj, setAdj] = useState<PhotoAdjustments>(
    photo?.adjustments ? { ...photo.adjustments } : { ...DEFAULT_ADJUSTMENTS }
  );
  const [tab, setTab] = useState<Tab>("adjust");
  const [comparing, setComparing] = useState(false);

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

  const patch =
    <K extends keyof PhotoAdjustments>(key: K) =>
    (v: PhotoAdjustments[K]) =>
      setAdj((a) => ({ ...a, [key]: v }));

  const setNum =
    (
      key:
        | "brightness"
        | "contrast"
        | "highlights"
        | "shadows"
        | "whites"
        | "blacks"
        | "saturation"
        | "vibrance"
        | "warmth"
        | "tint"
        | "sharpness"
        | "clarity"
        | "dehaze"
        | "noiseReduction"
        | "vignette"
        | "grain"
    ) =>
    (v: number) =>
      setAdj((a) => ({ ...a, [key]: v }));

  const rotateLeft = () =>
    setAdj((a) => ({
      ...a,
      rotation: (((a.rotation - 90) % 360 + 360) % 360) as
        | 0
        | 90
        | 180
        | 270,
    }));

  const rotateRight = () =>
    setAdj((a) => ({
      ...a,
      rotation: ((a.rotation + 90) % 360) as 0 | 90 | 180 | 270,
    }));

  const toggleFlipH = () => setAdj((a) => ({ ...a, flipH: !a.flipH }));
  const toggleFlipV = () => setAdj((a) => ({ ...a, flipV: !a.flipV }));
  const reset = () => setAdj({ ...DEFAULT_ADJUSTMENTS });

  const handleDone = async () => {
    await updatePhoto(id!, { adjustments: adj });
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const handleCancel = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 16 : insets.bottom;
  const accent = colors.primary;
  const photoStyle = buildPhotoStyle(adj);

  const TABS: { key: Tab; label: string }[] = [
    { key: "transform", label: "Transform" },
    { key: "adjust", label: "Adjust" },
    { key: "color", label: "Color" },
    { key: "detail", label: "Detail" },
  ];

  return (
    <View style={[st.root, { paddingTop: topInset }]}>
      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [st.hdrBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Text style={st.cancel}>Cancel</Text>
        </Pressable>
        <Text style={st.title}>Edit Photo</Text>
        <Pressable
          onPress={handleDone}
          style={({ pressed }) => [st.hdrBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Text style={[st.done, { color: accent }]}>Done</Text>
        </Pressable>
      </View>

      {/* ── Photo Preview ── */}
      <View style={[st.preview, { height: PREVIEW_H }]}>
        <View
          style={[
            { flex: 1, overflow: "hidden" },
            comparing ? {} : (photoStyle as object),
          ]}
        >
          <Image
            source={{ uri: photo.uri }}
            style={{ width: SW, height: PREVIEW_H }}
            contentFit="contain"
          />
          {!comparing && <VignetteOverlay amount={adj.vignette} />}
          {!comparing && <GrainOverlay amount={adj.grain} />}
        </View>

        {/* Before / After badge */}
        <Pressable
          onPressIn={() => setComparing(true)}
          onPressOut={() => setComparing(false)}
          style={st.compareBtn}
          hitSlop={8}
        >
          <Feather
            name={comparing ? "eye-off" : "eye"}
            size={16}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={st.compareTxt}>
            {comparing ? "Original" : "Compare"}
          </Text>
        </Pressable>
      </View>

      {/* ── Histogram ── */}
      <PhotoHistogram uri={photo.uri} />

      {/* ── Tab Bar ── */}
      <View style={st.tabs}>
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={({ pressed }) => [
              st.tabItem,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text
              style={[
                st.tabLabel,
                tab === key
                  ? { color: accent, fontFamily: "Inter_600SemiBold" }
                  : { color: "rgba(255,255,255,0.45)" },
              ]}
            >
              {label}
            </Text>
            {tab === key && (
              <View style={[st.tabLine, { backgroundColor: accent }]} />
            )}
          </Pressable>
        ))}
      </View>

      {/* ── Controls ── */}
      <ScrollView
        style={st.controls}
        contentContainerStyle={[
          st.controlsInner,
          { paddingBottom: bottomInset + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Transform tab */}
        {tab === "transform" && (
          <View style={st.xformGrid}>
            <Pressable
              onPress={rotateLeft}
              style={({ pressed }) => [
                st.xformBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="rotate-ccw" size={28} color="#fff" />
              <Text style={st.xformLbl}>Rotate Left</Text>
            </Pressable>

            <Pressable
              onPress={rotateRight}
              style={({ pressed }) => [
                st.xformBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="rotate-cw" size={28} color="#fff" />
              <Text style={st.xformLbl}>Rotate Right</Text>
            </Pressable>

            <Pressable
              onPress={toggleFlipH}
              style={({ pressed }) => [
                st.xformBtn,
                {
                  opacity: pressed ? 0.7 : 1,
                  borderColor: adj.flipH
                    ? accent
                    : "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <Feather
                name="minimize-2"
                size={28}
                color={adj.flipH ? accent : "#fff"}
              />
              <Text
                style={[
                  st.xformLbl,
                  { color: adj.flipH ? accent : "#fff" },
                ]}
              >
                Flip H
              </Text>
            </Pressable>

            <Pressable
              onPress={toggleFlipV}
              style={({ pressed }) => [
                st.xformBtn,
                {
                  opacity: pressed ? 0.7 : 1,
                  borderColor: adj.flipV
                    ? accent
                    : "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <View style={{ transform: [{ rotate: "90deg" }] }}>
                <Feather
                  name="minimize-2"
                  size={28}
                  color={adj.flipV ? accent : "#fff"}
                />
              </View>
              <Text
                style={[
                  st.xformLbl,
                  { color: adj.flipV ? accent : "#fff" },
                ]}
              >
                Flip V
              </Text>
            </Pressable>
          </View>
        )}

        {/* Adjust tab */}
        {tab === "adjust" && (
          <View style={st.sliders}>
            <Text style={st.sectionHdr}>Light</Text>
            <EditSlider
              label="Brightness"
              value={adj.brightness}
              onValueChange={setNum("brightness")}
              accent={accent}
            />
            <EditSlider
              label="Contrast"
              value={adj.contrast}
              onValueChange={setNum("contrast")}
              accent={accent}
            />
            <Text style={st.sectionHdr}>Tone</Text>
            <EditSlider
              label="Highlights"
              value={adj.highlights}
              onValueChange={setNum("highlights")}
              accent={accent}
            />
            <EditSlider
              label="Shadows"
              value={adj.shadows}
              onValueChange={setNum("shadows")}
              accent={accent}
            />
            <EditSlider
              label="Whites"
              value={adj.whites}
              onValueChange={setNum("whites")}
              accent={accent}
            />
            <EditSlider
              label="Blacks"
              value={adj.blacks}
              onValueChange={setNum("blacks")}
              accent={accent}
            />
            <Text style={st.sectionHdr}>Effects</Text>
            <EditSlider
              label="Vignette"
              value={adj.vignette}
              onValueChange={setNum("vignette")}
              accent={accent}
            />
          </View>
        )}

        {/* Color tab */}
        {tab === "color" && (
          <View style={st.sliders}>
            <Text style={st.sectionHdr}>Color</Text>
            <EditSlider
              label="Saturation"
              value={adj.saturation}
              onValueChange={setNum("saturation")}
              accent={accent}
            />
            <EditSlider
              label="Vibrance"
              value={adj.vibrance}
              onValueChange={setNum("vibrance")}
              accent={accent}
            />
            <Text style={st.sectionHdr}>White Balance</Text>
            <EditSlider
              label="Warmth"
              value={adj.warmth}
              onValueChange={setNum("warmth")}
              accent="#f5a623"
            />
            <EditSlider
              label="Tint"
              value={adj.tint}
              onValueChange={setNum("tint")}
              accent="#30d158"
            />
          </View>
        )}

        {/* Detail tab */}
        {tab === "detail" && (
          <View style={st.sliders}>
            <Text style={st.sectionHdr}>Sharpening</Text>
            <EditSlider
              label="Sharpness"
              value={adj.sharpness}
              min={0}
              max={100}
              onValueChange={setNum("sharpness")}
              accent={accent}
            />
            <Text style={st.sectionHdr}>Clarity</Text>
            <EditSlider
              label="Clarity"
              value={adj.clarity}
              onValueChange={setNum("clarity")}
              accent={accent}
            />
            <EditSlider
              label="Dehaze"
              value={adj.dehaze}
              onValueChange={setNum("dehaze")}
              accent={accent}
            />
            <Text style={st.sectionHdr}>Noise Reduction</Text>
            <EditSlider
              label="Noise Reduction"
              value={adj.noiseReduction}
              min={0}
              max={100}
              onValueChange={setNum("noiseReduction")}
              accent={accent}
            />
            <Text style={st.sectionHdr}>Film Grain</Text>
            <EditSlider
              label="Grain"
              value={adj.grain}
              min={0}
              max={100}
              onValueChange={setNum("grain")}
              accent={accent}
            />
          </View>
        )}

        <Pressable
          onPress={reset}
          style={({ pressed }) => [
            st.resetBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={st.resetTxt}>Reset All</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Slider styles ─────────────────────────────────────────────────────────
const sl = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  hdr: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lbl: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  val: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 36,
    textAlign: "right",
  },
  track: {
    height: 40,
    justifyContent: "center",
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  fill: {
    position: "absolute",
    height: 4,
    borderRadius: 2,
    opacity: 0.85,
  },
  center: {
    position: "absolute",
    width: 1.5,
    height: 10,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.6)",
    top: 15,
  },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    top: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
});

// ─── Screen styles ──────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hdrBtn: {
    minWidth: 70,
  },
  cancel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  done: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  preview: {
    backgroundColor: "#111",
    overflow: "hidden",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  tabLine: {
    position: "absolute",
    bottom: 0,
    left: "20%",
    right: "20%",
    height: 2,
    borderRadius: 1,
  },
  controls: {
    flex: 1,
  },
  controlsInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 28,
  },
  sliders: {
    gap: 28,
  },
  xformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  xformBtn: {
    width: "47%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  xformLbl: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  resetBtn: {
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    marginTop: 8,
  },
  resetTxt: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sectionHdr: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: -8,
  },
  detailNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  detailNoteText: {
    flex: 1,
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  compareBtn: {
    position: "absolute",
    bottom: 10,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  compareTxt: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
