import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSettings } from "@/context/SettingsContext";

const PAD = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

export function AppLockScreen() {
  const { requiresUnlock, unlock, unlockBiometric, settings, appLockPin } = useSettings();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (requiresUnlock) {
      setPin("");
      setError(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      if (settings.appLockEnabled) {
        unlockBiometric();
      }
    }
  }, [requiresUnlock]);

  if (!requiresUnlock || !appLockPin) return null;

  const shake = () => {
    setError(true);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => { setPin(""); setError(false); });
  };

  const handleKey = (key: string) => {
    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
      setError(false);
      return;
    }
    const next = pin + key;
    setPin(next);
    if (next.length >= (appLockPin?.length ?? 4)) {
      const ok = unlock(next);
      if (!ok) {
        shake();
      } else {
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
    }
  };

  return (
    <Animated.View style={[ls.overlay, { opacity: fadeAnim }]}>
      <View style={ls.inner}>
        <View style={ls.iconWrap}>
          <Feather name="lock" size={32} color="rgba(255,255,255,0.8)" />
        </View>
        <Text style={ls.title}>Photos is Locked</Text>
        <Text style={ls.subtitle}>Enter your PIN to continue</Text>

        <Animated.View style={[ls.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: appLockPin?.length ?? 4 }).map((_, i) => (
            <View
              key={i}
              style={[
                ls.dot,
                pin.length > i && ls.dotFilled,
                error && ls.dotError,
              ]}
            />
          ))}
        </Animated.View>

        <View style={ls.pad}>
          {PAD.map((key, i) => (
            key === "" ? (
              <View key={i} style={ls.padKey} />
            ) : (
              <Pressable
                key={i}
                onPress={() => handleKey(key)}
                style={({ pressed }) => [ls.padKey, ls.padKeyBtn, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Text style={ls.padKeyText}>{key}</Text>
              </Pressable>
            )
          ))}
        </View>

        <Pressable onPress={unlockBiometric} style={ls.bioBtn} hitSlop={12}>
          <Feather name="aperture" size={22} color="rgba(255,255,255,0.5)" />
          <Text style={ls.bioLabel}>Use Biometrics</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const ls = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#111", zIndex: 9999, alignItems: "center", justifyContent: "center" },
  inner: { width: "100%", maxWidth: 340, alignItems: "center", gap: 12, paddingHorizontal: 24 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  subtitle: { color: "rgba(255,255,255,0.45)", fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
  dotsRow: { flexDirection: "row", gap: 16, marginVertical: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)" },
  dotFilled: { backgroundColor: "#fff", borderColor: "#fff" },
  dotError: { borderColor: "#ff453a", backgroundColor: "#ff453a" },
  pad: { flexDirection: "row", flexWrap: "wrap", width: 240, gap: 0 },
  padKey: { width: 80, height: 72, alignItems: "center", justifyContent: "center" },
  padKeyBtn: {},
  padKeyText: { color: "#fff", fontSize: 26, fontFamily: "Inter_400Regular" },
  bioBtn: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  bioLabel: { color: "rgba(255,255,255,0.45)", fontSize: 14, fontFamily: "Inter_400Regular" },
});
