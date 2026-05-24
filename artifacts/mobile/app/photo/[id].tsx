import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlagStatus, Photo, usePhotos } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";
import { buildPhotoStyle } from "@/utils/photoStyle";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const COLOR_LABELS: { key: string; color: string; label: string }[] = [
  { key: "red",    color: "#ff453a", label: "Red" },
  { key: "orange", color: "#ff9f0a", label: "Orange" },
  { key: "yellow", color: "#ffd60a", label: "Yellow" },
  { key: "green",  color: "#30d158", label: "Green" },
  { key: "blue",   color: "#0a84ff", label: "Blue" },
  { key: "purple", color: "#bf5af2", label: "Purple" },
];

function StarRating({ rating, onChange }: { rating: number; onChange: (v: number) => void }) {
  return (
    <View style={rSt.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(rating === star ? 0 : star)}
          hitSlop={6}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather
            name="star"
            size={22}
            color={star <= rating ? "#ffd60a" : "rgba(255,255,255,0.25)"}
          />
        </Pressable>
      ))}
    </View>
  );
}

const rSt = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignItems: "center" },
});

function FlagButton({ flag, onChange }: { flag: FlagStatus; onChange: (f: FlagStatus) => void }) {
  return (
    <View style={flagSt.row}>
      <Pressable
        onPress={() => onChange(flag === "pick" ? null : "pick")}
        hitSlop={6}
        style={[flagSt.btn, flag === "pick" && flagSt.pickActive]}
      >
        <Feather name="check" size={14} color={flag === "pick" ? "#fff" : "rgba(255,255,255,0.5)"} />
        <Text style={[flagSt.label, flag === "pick" && { color: "#fff" }]}>Pick</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(flag === "reject" ? null : "reject")}
        hitSlop={6}
        style={[flagSt.btn, flag === "reject" && flagSt.rejectActive]}
      >
        <Feather name="x" size={14} color={flag === "reject" ? "#fff" : "rgba(255,255,255,0.5)"} />
        <Text style={[flagSt.label, flag === "reject" && { color: "#fff" }]}>Reject</Text>
      </Pressable>
      {flag && (
        <Pressable onPress={() => onChange(null)} hitSlop={8} style={flagSt.clearBtn}>
          <Feather name="minus-circle" size={14} color="rgba(255,255,255,0.35)" />
        </Pressable>
      )}
    </View>
  );
}

const flagSt = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  btn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.5)" },
  pickActive: { backgroundColor: "#30d158", borderColor: "#30d158" },
  rejectActive: { backgroundColor: "#ff453a", borderColor: "#ff453a" },
  clearBtn: { padding: 4 },
});

function ExifSection({ photo }: { photo: Photo }) {
  const date = new Date(photo.timestamp);
  const dateStr = date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const rows: { label: string; value: string }[] = [
    { label: "Date", value: dateStr },
    { label: "Time", value: timeStr },
    { label: "Dimensions", value: photo.width && photo.height ? `${photo.width} × ${photo.height} px` : "Unknown" },
    { label: "File Format", value: photo.uri.startsWith("data:") ? "Base64" : photo.uri.split(".").pop()?.toUpperCase() ?? "JPEG" },
    { label: "Color Space", value: "sRGB" },
    { label: "Rating", value: photo.rating ? `${photo.rating} / 5 ★` : "Unrated" },
    { label: "Flag", value: photo.flag ? (photo.flag === "pick" ? "✓ Pick" : "✗ Reject") : "Unflagged" },
    { label: "Color Label", value: photo.colorLabel ? photo.colorLabel.charAt(0).toUpperCase() + photo.colorLabel.slice(1) : "None" },
    { label: "Tags", value: photo.tags && photo.tags.length > 0 ? photo.tags.join(", ") : "None" },
    { label: "Edited", value: photo.adjustments ? "Yes" : "No" },
  ];

  return (
    <View style={exifSt.wrap}>
      <Text style={exifSt.sectionTitle}>EXIF & Metadata</Text>
      {rows.map(({ label, value }) => (
        <View key={label} style={exifSt.row}>
          <Text style={exifSt.label}>{label}</Text>
          <Text style={exifSt.value} numberOfLines={1}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const exifSt = StyleSheet.create({
  wrap: { paddingTop: 4 },
  sectionTitle: { color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.06)" },
  label: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  value: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, textAlign: "right" },
});

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, loading, deletePhoto, toggleFavorite, updatePhoto } = usePhotos();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [showInfo, setShowInfo] = useState(false);
  const [currentId, setCurrentId] = useState(id ?? "");
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showExif, setShowExif] = useState(false);

  const initialIndex = useMemo(
    () => Math.max(photos.findIndex((p) => p.id === id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const flatListRef = useRef<FlatList<Photo>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.item) {
        setCurrentId((viewableItems[0].item as Photo).id);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const currentPhoto = useMemo(
    () => photos.find((p) => p.id === currentId),
    [photos, currentId]
  );

  const currentIndex = useMemo(
    () => photos.findIndex((p) => p.id === currentId),
    [photos, currentId]
  );

  const handleDelete = () => {
    const doDelete = async () => {
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      await deletePhoto(currentId);
      if (photos.length <= 1) {
        if (router.canGoBack()) router.back();
        else router.replace("/");
      } else {
        const nextIndex = Math.min(currentIndex, photos.length - 2);
        const next = photos.filter((p) => p.id !== currentId)[nextIndex];
        if (next) setCurrentId(next.id);
        else if (router.canGoBack()) router.back();
        else router.replace("/");
      }
    };
    if (Platform.OS === "web") { doDelete(); return; }
    Alert.alert("Delete Photo", "This photo will be permanently deleted.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  const handleShare = async () => {
    if (!currentPhoto) return;
    if (Platform.OS === "web") {
      if (navigator.share) {
        try { await navigator.share({ url: currentPhoto.uri }); } catch {}
      }
      return;
    }
    try {
      await Share.share({ url: currentPhoto.uri, message: currentPhoto.uri });
    } catch {}
  };

  const handleToggleFavorite = async () => {
    if (!currentPhoto) return;
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(
        currentPhoto.favorited
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium
      );
    }
    await toggleFavorite(currentId);
  };

  const handleEdit = () => {
    router.push({ pathname: "/edit/[id]", params: { id: currentId } });
  };

  const handleRating = async (rating: number) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updatePhoto(currentId, { rating });
  };

  const handleFlag = async (flag: FlagStatus) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updatePhoto(currentId, { flag });
  };

  const handleColorLabel = async (label: string | null) => {
    const next = currentPhoto?.colorLabel === label ? null : label;
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updatePhoto(currentId, { colorLabel: next });
  };

  const handleAddTag = async () => {
    const tag = tagInput.trim();
    if (!tag || !currentPhoto) return;
    const existing = currentPhoto.tags ?? [];
    if (existing.includes(tag)) { setTagInput(""); return; }
    await updatePhoto(currentId, { tags: [...existing, tag] });
    setTagInput("");
  };

  const handleRemoveTag = async (tag: string) => {
    if (!currentPhoto) return;
    const next = (currentPhoto.tags ?? []).filter((t) => t !== tag);
    await updatePhoto(currentId, { tags: next });
  };

  useEffect(() => {
    if (!loading && photos.length === 0) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
  }, [loading, photos.length, router]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Photo>) => {
      const photoStyle = buildPhotoStyle(item.adjustments);
      return (
        <Pressable
          style={styles.slide}
          onPress={() => setShowInfo((v) => !v)}
          delayLongPress={99999}
        >
          <View style={[styles.imageWrap, photoStyle as object]}>
            <Image
              source={{ uri: item.uri }}
              style={styles.image}
              contentFit="contain"
              transition={100}
            />
          </View>
        </Pressable>
      );
    },
    []
  );

  const keyExtractor = useCallback((item: Photo) => item.id, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (loading || photos.length === 0) {
    return <View style={styles.container} />;
  }

  const isFav = currentPhoto?.favorited ?? false;
  const rating = currentPhoto?.rating ?? 0;
  const colorLabel = currentPhoto?.colorLabel ?? null;
  const tags = currentPhoto?.tags ?? [];
  const flag = currentPhoto?.flag ?? null;

  const activeLabel = COLOR_LABELS.find((l) => l.key === colorLabel);

  const flagColor = flag === "pick" ? "#30d158" : flag === "reject" ? "#ff453a" : null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={photos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        decelerationRate="fast"
      />

      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={12}
        >
          <Feather name="chevron-left" size={28} color="#fff" />
        </Pressable>

        <View style={styles.topCenter}>
          <Text style={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </Text>
          {activeLabel && (
            <View style={[styles.labelDot, { backgroundColor: activeLabel.color }]} />
          )}
          {rating > 0 && (
            <View style={styles.ratingBadge}>
              <Feather name="star" size={10} color="#ffd60a" />
              <Text style={styles.ratingBadgeText}>{rating}</Text>
            </View>
          )}
          {flag && (
            <View style={[styles.flagBadge, { backgroundColor: flagColor! }]}>
              <Feather name={flag === "pick" ? "check" : "x"} size={10} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.topRight}>
          <Pressable onPress={handleToggleFavorite} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={12}>
            <Feather name="heart" size={20} color={isFav ? "#ff2d55" : "#fff"} />
          </Pressable>
          <Pressable onPress={handleShare} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={12}>
            <Feather name="share" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={handleEdit} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={12}>
            <Feather name="sliders" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={handleDelete} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]} hitSlop={12}>
            <Feather name="trash-2" size={20} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      {showInfo && currentPhoto && (
        <View style={[styles.infoBar, { paddingBottom: bottomInset + 8 }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.infoRow}>
              {isFav && <Feather name="heart" size={14} color="#ff2d55" />}
              <Text style={styles.infoText}>
                {new Date(currentPhoto.timestamp).toLocaleDateString("en-US", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </Text>
            </View>
            <Text style={styles.infoSubtext}>
              {new Date(currentPhoto.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </Text>

            <View style={styles.divider} />

            {/* Star Rating */}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Rating</Text>
              <StarRating rating={rating} onChange={handleRating} />
            </View>

            {/* Flag / Pick Status */}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Flag</Text>
              <FlagButton flag={flag} onChange={handleFlag} />
            </View>

            {/* Color Label */}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Label</Text>
              <View style={styles.labelsRow}>
                {COLOR_LABELS.map(({ key, color }) => (
                  <Pressable
                    key={key}
                    onPress={() => handleColorLabel(key)}
                    style={[
                      styles.labelCircle,
                      { backgroundColor: color },
                      colorLabel === key && styles.labelCircleActive,
                    ]}
                    hitSlop={6}
                  />
                ))}
                {colorLabel && (
                  <Pressable onPress={() => handleColorLabel(null)} hitSlop={8} style={styles.clearLabel}>
                    <Feather name="x" size={12} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Tags */}
            <View style={styles.tagsSection}>
              <Text style={styles.metaLabel}>Tags</Text>
              <View style={styles.tagsWrap}>
                {tags.map((tag) => (
                  <Pressable key={tag} onPress={() => handleRemoveTag(tag)} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                    <Feather name="x" size={10} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                ))}
                {editingTags ? (
                  <TextInput
                    style={styles.tagInput}
                    value={tagInput}
                    onChangeText={setTagInput}
                    placeholder="Add tag…"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    returnKeyType="done"
                    autoFocus
                    onSubmitEditing={handleAddTag}
                    onBlur={() => { setEditingTags(false); setTagInput(""); }}
                  />
                ) : (
                  <Pressable onPress={() => setEditingTags(true)} style={styles.addTagBtn}>
                    <Feather name="plus" size={12} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.addTagLabel}>Add</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            {/* EXIF Toggle */}
            <Pressable onPress={() => setShowExif((v) => !v)} style={styles.exifToggle}>
              <Feather name="info" size={14} color="rgba(255,255,255,0.4)" />
              <Text style={styles.exifToggleLabel}>EXIF & Metadata</Text>
              <Feather name={showExif ? "chevron-up" : "chevron-down"} size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>

            {showExif && <ExifSection photo={currentPhoto} />}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  slide: {
    width: SCREEN_WIDTH, height: SCREEN_HEIGHT,
    alignItems: "center", justifyContent: "center",
  },
  imageWrap: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 12, paddingBottom: 12,
  },
  topCenter: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  counter: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontFamily: "Inter_500Medium" },
  labelDot: { width: 10, height: 10, borderRadius: 5 },
  ratingBadge: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  ratingBadgeText: { color: "#ffd60a", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  flagBadge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  topRight: { flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    borderRadius: 18, backgroundColor: "rgba(0,0,0,0.4)",
  },
  infoBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 20, paddingTop: 16,
    maxHeight: SCREEN_HEIGHT * 0.55,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { color: "#fff", fontSize: 16, fontFamily: "Inter_500Medium" },
  infoSubtext: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  metaLabel: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase" },
  labelsRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  labelCircle: { width: 22, height: 22, borderRadius: 11, opacity: 0.7 },
  labelCircleActive: { opacity: 1, borderWidth: 2, borderColor: "#fff" },
  clearLabel: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  tagsSection: { marginBottom: 8 },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" },
  tagInput: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    color: "#fff", fontSize: 12, minWidth: 80,
  },
  addTagBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed",
  },
  addTagLabel: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular" },
  exifToggle: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8,
  },
  exifToggleLabel: { flex: 1, color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_500Medium" },
});
