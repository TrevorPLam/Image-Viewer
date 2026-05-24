import React, { useCallback, useRef } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import { Circle, Defs, Path, RadialGradient, Stop, Svg } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

export interface WheelValue { hue: number; sat: number; lum: number; }

interface WheelProps {
  label: string;
  value: WheelValue;
  onChange: (v: WheelValue) => void;
  size?: number;
}

const SLICES = 72;

function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
}

export default function ColorGradingWheel({ label, value, onChange, size = 130 }: WheelProps) {
  const colors = useColors();
  const cx = size / 2;
  const cy = size / 2;
  const R  = size / 2 - 4;

  const sliceDeg = 360 / SLICES;

  const dotX = cx + (value.sat / 100) * R * Math.cos((value.hue * Math.PI) / 180);
  const dotY = cy + (value.sat / 100) * R * Math.sin((value.hue * Math.PI) / 180);

  const handleTouch = useCallback(
    (lx: number, ly: number) => {
      const dx = lx - cx;
      const dy = ly - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      const sat = Math.min(100, Math.round((dist / R) * 100));
      onChange({ ...value, hue: Math.round(angle), sat });
    },
    [cx, cy, R, value, onChange]
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
    })
  ).current;

  const lumPercent = ((value.lum + 100) / 200) * 100;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>

      <View {...pan.panHandlers}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`wg_${label}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#ffffff" stopOpacity={1} />
              <Stop offset="55%"  stopColor="#ffffff" stopOpacity={0.4} />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {Array.from({ length: SLICES }, (_, i) => {
            const hue = i * sliceDeg;
            return (
              <Path
                key={i}
                d={slicePath(cx, cy, R, hue - sliceDeg / 2, hue + sliceDeg / 2)}
                fill={`hsl(${hue}, 80%, 55%)`}
              />
            );
          })}

          <Circle cx={cx} cy={cy} r={R} fill={`url(#wg_${label})`} />

          {value.sat > 2 && (
            <Circle cx={dotX} cy={dotY} r={5} fill="white" stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
          )}
          {value.sat <= 2 && (
            <Circle cx={cx} cy={cy} r={5} fill="white" stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
          )}
        </Svg>
      </View>

      <View style={styles.lumRow}>
        <Text style={[styles.lumLabel, { color: colors.mutedForeground }]}>
          {value.lum > 0 ? "+" : ""}{value.lum}
        </Text>
        <View style={[styles.lumTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.lumFill,
              {
                left: `${Math.min(lumPercent, 50)}%` as unknown as number,
                right: `${100 - Math.max(lumPercent, 50)}%` as unknown as number,
                backgroundColor: value.lum >= 0 ? "#ffffff" : "#555",
              },
            ]}
          />
          <View
            style={[styles.lumThumb, { left: `${lumPercent}%` as unknown as number, backgroundColor: "#fff" }]}
          />
        </View>
      </View>

      <View style={styles.lumSliderRow}>
        <Text style={[styles.lumEdge, { color: colors.mutedForeground }]}>−100</Text>
        <View style={styles.lumSliderArea} onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => handleLum(e.nativeEvent.locationX, e.nativeEvent.target)}
          onResponderMove={(e) => handleLum(e.nativeEvent.locationX, e.nativeEvent.target)}
        />
        <Text style={[styles.lumEdge, { color: colors.mutedForeground }]}>+100</Text>
      </View>
    </View>
  );

  function handleLum(lx: number, _target: unknown) {
    const trackW = size - 12;
    const pct = Math.max(0, Math.min(1, lx / trackW));
    const lum = Math.round(pct * 200 - 100);
    onChange({ ...value, lum });
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: 140,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lumRow: {
    width: "100%",
    paddingHorizontal: 6,
    marginTop: 8,
    position: "relative",
    height: 14,
  },
  lumLabel: {
    position: "absolute",
    top: -2,
    right: 6,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    zIndex: 2,
  },
  lumTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 5,
    position: "relative",
    overflow: "hidden",
  },
  lumFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "#fff",
  },
  lumThumb: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  lumSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 0,
    marginTop: 2,
  },
  lumEdge: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    width: 28,
    textAlign: "center",
  },
  lumSliderArea: {
    flex: 1,
    height: 20,
  },
});
