import React, { useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { HslAdjustments } from "@/context/PhotosContext";

type ColorKey = keyof HslAdjustments;

const COLOR_CHANNELS: { key: ColorKey; label: string; color: string }[] = [
  { key: "red",     label: "Red",     color: "#ff453a" },
  { key: "orange",  label: "Ora",     color: "#ff9f0a" },
  { key: "yellow",  label: "Yel",     color: "#ffd60a" },
  { key: "green",   label: "Grn",     color: "#30d158" },
  { key: "aqua",    label: "Aqu",     color: "#32ade6" },
  { key: "blue",    label: "Blu",     color: "#0a84ff" },
  { key: "purple",  label: "Pur",     color: "#bf5af2" },
  { key: "magenta", label: "Mag",     color: "#ff375f" },
];

type Param = "h" | "s" | "l";

interface MiniSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  accent: string;
}

function MiniSlider({ label, value, min, max, onChange, accent }: MiniSliderProps) {
  const [trackW, setTrackW] = useState(230);
  const startX = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        const x = Math.max(0, Math.min(e.nativeEvent.locationX, trackW));
        onChange(Math.round(min + (x / trackW) * (max - min)));
      },
      onPanResponderMove: (_, gs) => {
        const x = Math.max(0, Math.min(startX.current + gs.dx, trackW));
        onChange(Math.round(min + (x / trackW) * (max - min)));
      },
    })
  ).current;

  const thumbPct = Math.max(0, Math.min((value - min) / (max - min), 1));
  const centerPct = -min / (max - min);
  const fillL = Math.min(centerPct, thumbPct) * trackW;
  const fillW = Math.abs(thumbPct - centerPct) * trackW;

  return (
    <View style={ms.wrap}>
      <View style={ms.row}>
        <Text style={ms.label}>{label}</Text>
        <Text style={[ms.val, { color: value !== 0 ? accent : "rgba(255,255,255,0.3)" }]}>
          {value > 0 ? `+${value}` : `${value}`}
        </Text>
      </View>
      <View
        style={ms.track}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={ms.trackBg} />
        <View style={[ms.fill, { left: fillL, width: Math.max(0, fillW), backgroundColor: accent }]} />
        <View style={[ms.center, { left: centerPct * trackW - 0.75 }]} />
        <View style={[ms.thumb, { left: Math.max(0, thumbPct * trackW - 9) }]} />
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_500Medium" },
  val: { fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 32, textAlign: "right" },
  track: { height: 36, justifyContent: "center" },
  trackBg: {
    position: "absolute", left: 0, right: 0, height: 3,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2,
  },
  fill: { position: "absolute", height: 3, borderRadius: 2 },
  center: { position: "absolute", width: 1.5, height: 8, top: "50%", marginTop: -4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 1 },
  thumb: {
    position: "absolute", width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#fff", top: "50%", marginTop: -9,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2,
  },
});

interface Props {
  hsl: HslAdjustments;
  onChange: (hsl: HslAdjustments) => void;
}

export default function HSLPanel({ hsl, onChange }: Props) {
  const [selected, setSelected] = useState<ColorKey>("red");

  const current = hsl[selected];
  const accentColor = COLOR_CHANNELS.find((c) => c.key === selected)?.color ?? "#fff";

  const updateParam = (param: Param, value: number) => {
    onChange({
      ...hsl,
      [selected]: { ...current, [param]: value },
    });
  };

  const hasMod = (key: ColorKey) => {
    const ch = hsl[key];
    return ch.h !== 0 || ch.s !== 0 || ch.l !== 0;
  };

  return (
    <View style={styles.container}>
      <View style={styles.swatchRow}>
        {COLOR_CHANNELS.map(({ key, label, color }) => (
          <Pressable
            key={key}
            onPress={() => setSelected(key)}
            style={[
              styles.swatch,
              { backgroundColor: color + (selected === key ? "ff" : "40") },
              selected === key && styles.swatchSelected,
            ]}
          >
            {hasMod(key) && <View style={[styles.modDot, { backgroundColor: color }]} />}
            <Text style={[styles.swatchLabel, { color: selected === key ? "#fff" : color }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sliders}>
        <MiniSlider
          label="Hue"
          value={current.h}
          min={-100} max={100}
          onChange={(v) => updateParam("h", v)}
          accent={accentColor}
        />
        <MiniSlider
          label="Saturation"
          value={current.s}
          min={-100} max={100}
          onChange={(v) => updateParam("s", v)}
          accent={accentColor}
        />
        <MiniSlider
          label="Luminance"
          value={current.l}
          min={-100} max={100}
          onChange={(v) => updateParam("l", v)}
          accent={accentColor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingHorizontal: 16 },
  swatchRow: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "space-between",
  },
  swatch: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  swatchSelected: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  modDot: {
    position: "absolute",
    top: 3, right: 3,
    width: 5, height: 5,
    borderRadius: 2.5,
  },
  swatchLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  sliders: { gap: 4 },
});
