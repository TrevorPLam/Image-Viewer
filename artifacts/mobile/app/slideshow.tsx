import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePhotos } from "@/context/PhotosContext";
import { useSettings } from "@/context/SettingsContext";
import { buildPhotoStyle } from "@/utils/photoStyle";

const { width: SW, height: SH } = Dimensions.get("window");

const TRANSITIONS: Record<string, string> = { fade: "Fade", slide: "Slide", zoom: "Zoom" };
const INTERVALS = [2, 3, 5, 8, 10];

export default function SlideshowScreen() {
  const { startId } = useLocalSearchParams<{ startId?: string }>();
  const { photos } = usePhotos();
  const { settings, updateSettings } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [playing, setPlaying] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(() => {
    if (startId) {
      const idx = photos.findIndex((p) => p.id === startId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);

  const fadeA = useRef(new Animated.Value(1)).current;
  const nextFadeA = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(1)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderedPhotos = useRef(photos);

  useEffect(() => {
    if (settings.slideshowShuffle) {
      const shuffled = [...photos].sort(() => Math.random() - 0.5);
      orderedPhotos.current = shuffled;
    } else {
      orderedPhotos.current = photos;
    }
  }, [photos, settings.slideshowShuffle]);

  const advance = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % orderedPhotos.current.length);
    progressAnim.setValue(0);

    if (settings.slideshowTransition === "fade") {
      Animated.parallel([
        Animated.timing(fadeA, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(nextFadeA, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        fadeA.setValue(1);
        nextFadeA.setValue(0);
      });
    } else if (settings.slideshowTransition === "zoom") {
      scaleA.setValue(1.08);
      Animated.spring(scaleA, { toValue: 1, friction: 8, useNativeDriver: true }).start();
    }
  }, [fadeA, nextFadeA, scaleA, progressAnim, settings.slideshowTransition]);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }
    const intervalMs = settings.slideshowInterval * 1000;
    progressAnim.setValue(0);
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        const next = p + 100 / (settings.slideshowInterval * 10);
        return Math.min(next, 100);
      });
    }, 100);
    const slideTimer = setInterval(advance, intervalMs);
    timerRef.current = slideTimer;
    progressTimerRef.current = progressInterval;
    return () => {
      clearInterval(slideTimer);
      clearInterval(progressInterval);
    };
  }, [playing, settings.slideshowInterval, advance, progressAnim]);

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    }, 3000);
  }, [controlsOpacity]);

  useEffect(() => {
    scheduleHideControls();
    return () => { if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current); };
  }, [scheduleHideControls]);

  const handleTap = () => {
    if (!showControls) {
      setShowControls(true);
      Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    scheduleHideControls();
  };

  const handlePrev = () => {
    setCurrentIdx((prev) => (prev - 1 + orderedPhotos.current.length) % orderedPhotos.current.length);
    progressAnim.setValue(0);
    setProgress(0);
  };

  const handleNext = () => {
    advance();
    setProgress(0);
  };

  const photo = orderedPhotos.current[currentIdx];
  if (!photo) {
    return (
      <View style={ss.root}>
        <Text style={{ color: "#fff" }}>No photos</Text>
      </View>
    );
  }

  const photoStyle = buildPhotoStyle(photo.adjustments);

  return (
    <Pressable style={ss.root} onPress={handleTap} delayLongPress={99999}>
      <Animated.View
        style={[ss.imageWrap, { opacity: fadeA, transform: [{ scale: scaleA }] }, photoStyle as object]}
      >
        <Image source={{ uri: photo.uri }} style={ss.image} contentFit="cover" transition={0} />
      </Animated.View>

      {settings.slideshowTransition === "fade" && (
        <Animated.View style={[ss.imageWrap, ss.nextImage, { opacity: nextFadeA }]}>
          <Image
            source={{ uri: orderedPhotos.current[(currentIdx + 1) % orderedPhotos.current.length]?.uri }}
            style={ss.image}
            contentFit="cover"
          />
        </Animated.View>
      )}

      {/* Progress bar */}
      <View style={[ss.progressBar, { top: (Platform.OS === "web" ? 0 : insets.top) }]}>
        <View style={[ss.progressFill, { width: `${progress}%` as unknown as number }]} />
      </View>

      {/* Dots */}
      <View style={ss.dots}>
        {orderedPhotos.current.map((_, i) => (
          <View
            key={i}
            style={[ss.dot, i === currentIdx && ss.dotActive]}
          />
        ))}
      </View>

      {/* Caption */}
      {photo.caption && (
        <Animated.View style={[ss.caption, { opacity: controlsOpacity }]}>
          <Text style={ss.captionText}>{photo.caption}</Text>
        </Animated.View>
      )}

      {/* Controls */}
      {showControls && (
        <Animated.View style={[ss.controls, { opacity: controlsOpacity, paddingTop: Platform.OS === "web" ? 16 : insets.top + 8, paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 8 }]}>
          <View style={ss.topRow}>
            <Pressable onPress={() => router.back()} style={ss.ctrl} hitSlop={12}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
            <View style={ss.topCenter}>
              <Text style={ss.slideCount}>{currentIdx + 1} / {orderedPhotos.current.length}</Text>
            </View>
            <View style={ss.topRight}>
              <Pressable
                onPress={() => updateSettings({ slideshowShuffle: !settings.slideshowShuffle })}
                style={[ss.ctrl, settings.slideshowShuffle && ss.ctrlActive]}
                hitSlop={12}
              >
                <Feather name="shuffle" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={ss.centerRow}>
            <Pressable onPress={handlePrev} style={ss.navBtn} hitSlop={16}>
              <Feather name="skip-back" size={28} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setPlaying((p) => !p)} style={ss.playBtn}>
              <Feather name={playing ? "pause" : "play"} size={32} color="#111" />
            </Pressable>
            <Pressable onPress={handleNext} style={ss.navBtn} hitSlop={16}>
              <Feather name="skip-forward" size={28} color="#fff" />
            </Pressable>
          </View>

          <View style={ss.bottomRow}>
            <Text style={ss.settingLabel}>Speed</Text>
            <View style={ss.speedRow}>
              {INTERVALS.map((v) => (
                <Pressable
                  key={v}
                  onPress={() => updateSettings({ slideshowInterval: v })}
                  style={[ss.speedBtn, settings.slideshowInterval === v && ss.speedBtnActive]}
                >
                  <Text style={[ss.speedLabel, settings.slideshowInterval === v && ss.speedLabelActive]}>
                    {v}s
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={ss.settingLabel}>Transition</Text>
            <View style={ss.transRow}>
              {(Object.keys(TRANSITIONS) as Array<keyof typeof TRANSITIONS>).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => updateSettings({ slideshowTransition: t as "fade" | "slide" | "zoom" })}
                  style={[ss.speedBtn, settings.slideshowTransition === t && ss.speedBtnActive]}
                >
                  <Text style={[ss.speedLabel, settings.slideshowTransition === t && ss.speedLabelActive]}>
                    {TRANSITIONS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  imageWrap: { ...StyleSheet.absoluteFillObject },
  nextImage: { zIndex: 1 },
  image: { width: SW, height: SH },
  progressBar: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "rgba(255,255,255,0.2)", zIndex: 10 },
  progressFill: { height: 2, backgroundColor: "rgba(255,255,255,0.85)" },
  dots: { position: "absolute", bottom: 100, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5, zIndex: 10 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive: { backgroundColor: "#fff", width: 16, borderRadius: 3 },
  caption: { position: "absolute", bottom: 130, left: 20, right: 20, alignItems: "center", zIndex: 10 },
  captionText: { color: "#fff", fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  controls: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "space-between", zIndex: 20 },
  topRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  topCenter: { flex: 1, alignItems: "center" },
  topRight: { flexDirection: "row", gap: 8 },
  slideCount: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_500Medium" },
  ctrl: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  ctrlActive: { backgroundColor: "rgba(10,132,255,0.7)" },
  centerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  navBtn: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  playBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  bottomRow: { paddingHorizontal: 20, gap: 8 },
  settingLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  speedRow: { flexDirection: "row", gap: 8 },
  transRow: { flexDirection: "row", gap: 8 },
  speedBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  speedBtnActive: { backgroundColor: "#0a84ff" },
  speedLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_500Medium" },
  speedLabelActive: { color: "#fff" },
});
