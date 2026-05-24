import React, { useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Circle, Defs, Line, Path, Rect, Stop, LinearGradient, Svg } from "react-native-svg";

import { CurvePoint } from "@/context/PhotosContext";

const CURVE_SIZE = 220;
const POINT_RADIUS = 8;
const HIT_RADIUS = 18;

function catmullRomPath(pts: CurvePoint[], size: number): string {
  if (pts.length < 2) return "";
  const sorted = [...pts].sort((a, b) => a.x - b.x);
  const px = sorted.map((p) => ({ x: p.x * size, y: (1 - p.y) * size }));

  if (px.length === 2) {
    return `M ${px[0].x},${px[0].y} L ${px[1].x},${px[1].y}`;
  }

  let path = `M ${px[0].x},${px[0].y}`;
  for (let i = 0; i < px.length - 1; i++) {
    const p0 = px[Math.max(0, i - 1)];
    const p1 = px[i];
    const p2 = px[i + 1];
    const p3 = px[Math.min(px.length - 1, i + 2)];
    const alpha = 0.5;
    const cp1x = p1.x + (p2.x - p0.x) * alpha / 3;
    const cp1y = p1.y + (p2.y - p0.y) * alpha / 3;
    const cp2x = p2.x - (p3.x - p1.x) * alpha / 3;
    const cp2y = p2.y - (p3.y - p1.y) * alpha / 3;
    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return path;
}

type Channel = "rgb" | "r" | "g" | "b";

interface Props {
  points: CurvePoint[];
  onChange: (pts: CurvePoint[]) => void;
  channel?: Channel;
  onChannelChange?: (ch: Channel) => void;
  accent?: string;
}

const CHANNEL_COLORS: Record<Channel, string> = {
  rgb: "#ffffff",
  r: "#ff453a",
  g: "#30d158",
  b: "#0a84ff",
};

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "rgb", label: "RGB" },
  { key: "r", label: "R" },
  { key: "g", label: "G" },
  { key: "b", label: "B" },
];

export default function CurveEditor({
  points,
  onChange,
  channel = "rgb",
  onChannelChange,
  accent = "#fff",
}: Props) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const containerRef = useRef<View>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const curveColor = CHANNEL_COLORS[channel];

  const findNearestPoint = (nx: number, ny: number): number => {
    let best = -1;
    let bestDist = HIT_RADIUS / CURVE_SIZE;
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - nx;
      const dy = points[i].y - ny;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const nx = Math.max(0, Math.min(1, locationX / CURVE_SIZE));
        const ny = Math.max(0, Math.min(1, 1 - locationY / CURVE_SIZE));
        const idx = findNearestPoint(nx, ny);

        if (idx >= 0) {
          setDraggingIdx(idx);
          offsetRef.current = { x: nx - points[idx].x, y: ny - points[idx].y };
        } else {
          const newPt: CurvePoint = { x: nx, y: ny };
          const newPts = [...points, newPt];
          onChange(newPts);
          setDraggingIdx(newPts.length - 1);
          offsetRef.current = { x: 0, y: 0 };
        }
      },
      onPanResponderMove: (e, gs) => {
        if (draggingIdx === null) return;
        const { locationX, locationY } = e.nativeEvent;
        const nx = Math.max(0, Math.min(1, locationX / CURVE_SIZE));
        const ny = Math.max(0, Math.min(1, 1 - locationY / CURVE_SIZE));
        const newPts = points.map((p, i) =>
          i === draggingIdx
            ? { x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) }
            : p
        );
        onChange(newPts);
      },
      onPanResponderRelease: () => setDraggingIdx(null),
      onPanResponderTerminate: () => setDraggingIdx(null),
    })
  ).current;

  const removePoint = (idx: number) => {
    const pts = sorted;
    if (pts[idx].x === 0 || pts[idx].x === 1) return;
    const origIdx = points.findIndex(
      (p) => Math.abs(p.x - pts[idx].x) < 0.001 && Math.abs(p.y - pts[idx].y) < 0.001
    );
    if (origIdx >= 0) {
      onChange(points.filter((_, i) => i !== origIdx));
    }
  };

  const resetCurve = () => {
    onChange([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  };

  const gridLines = [0.25, 0.5, 0.75];

  return (
    <View style={styles.container}>
      <View style={styles.channelRow}>
        {CHANNELS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => onChannelChange?.(key)}
            style={[
              styles.channelBtn,
              channel === key && { backgroundColor: `${CHANNEL_COLORS[key]}22`, borderColor: CHANNEL_COLORS[key] },
            ]}
          >
            <Text style={[styles.channelLabel, { color: channel === key ? CHANNEL_COLORS[key] : "rgba(255,255,255,0.4)" }]}>
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={resetCurve} style={styles.resetBtn}>
          <Text style={styles.resetLabel}>Reset</Text>
        </Pressable>
      </View>

      <View
        ref={containerRef}
        style={styles.svgWrap}
        {...pan.panHandlers}
      >
        <Svg width={CURVE_SIZE} height={CURVE_SIZE}>
          <Defs>
            <LinearGradient id="curveBg" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0%" stopColor="#000" stopOpacity={1} />
              <Stop offset="100%" stopColor="#fff" stopOpacity={1} />
            </LinearGradient>
          </Defs>

          <Rect x={0} y={0} width={CURVE_SIZE} height={CURVE_SIZE} fill="rgba(0,0,0,0.6)" rx={6} />

          {gridLines.map((t) => (
            <React.Fragment key={t}>
              <Line
                x1={t * CURVE_SIZE} y1={0}
                x2={t * CURVE_SIZE} y2={CURVE_SIZE}
                stroke="rgba(255,255,255,0.08)" strokeWidth={1}
              />
              <Line
                x1={0} y1={t * CURVE_SIZE}
                x2={CURVE_SIZE} y2={t * CURVE_SIZE}
                stroke="rgba(255,255,255,0.08)" strokeWidth={1}
              />
            </React.Fragment>
          ))}

          <Line
            x1={0} y1={CURVE_SIZE} x2={CURVE_SIZE} y2={0}
            stroke="rgba(255,255,255,0.15)" strokeWidth={1}
            strokeDasharray="4,4"
          />

          <Path
            d={catmullRomPath(points, CURVE_SIZE)}
            stroke={curveColor}
            strokeWidth={1.5}
            fill="none"
            opacity={0.9}
          />

          {sorted.map((pt, i) => (
            <Circle
              key={i}
              cx={pt.x * CURVE_SIZE}
              cy={(1 - pt.y) * CURVE_SIZE}
              r={POINT_RADIUS / 2 + 1}
              fill={curveColor}
              opacity={0.9}
              onPress={() => removePoint(i)}
            />
          ))}
        </Svg>
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>Tap to add point · Press point to remove</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingHorizontal: 16 },
  channelRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  channelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  channelLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  resetBtn: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  resetLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  svgWrap: {
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },
  hint: { alignItems: "center" },
  hintText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
