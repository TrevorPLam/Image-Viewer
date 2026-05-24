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
  Share,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Photo, usePhotos } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";
import { buildPhotoStyle } from "@/utils/photoStyle";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, loading, deletePhoto, toggleFavorite } = usePhotos();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [showInfo, setShowInfo] = useState(false);
  const [currentId, setCurrentId] = useState(id ?? "");

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

        <Text style={styles.counter}>
          {currentIndex + 1} / {photos.length}
        </Text>

        <View style={styles.topRight}>
          <Pressable
            onPress={handleToggleFavorite}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={12}
          >
            <Feather
              name="heart"
              size={20}
              color={isFav ? "#ff2d55" : "#fff"}
            />
          </Pressable>
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={12}
          >
            <Feather name="share" size={20} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={12}
          >
            <Feather name="sliders" size={20} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={12}
          >
            <Feather name="trash-2" size={20} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      {showInfo && currentPhoto && (
        <View
          style={[
            styles.infoBar,
            {
              backgroundColor: "rgba(0,0,0,0.72)",
              paddingBottom: bottomInset + 16,
            },
          ]}
        >
          <View style={styles.infoRow}>
            {isFav && (
              <Feather name="heart" size={14} color="#ff2d55" />
            )}
            <Text style={styles.infoText}>
              {new Date(currentPhoto.timestamp).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
          <Text style={styles.infoSubtext}>
            {new Date(currentPhoto.timestamp).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  counter: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  topRight: {
    flexDirection: "row",
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  infoBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  infoSubtext: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
