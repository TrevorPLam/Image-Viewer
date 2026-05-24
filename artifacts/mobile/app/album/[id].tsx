import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoGrid } from "@/components/PhotoGrid";
import { useAlbums } from "@/context/AlbumsContext";
import { usePhotos } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";

const SMART_FILTERS: Record<string, (photos: ReturnType<typeof usePhotos>["photos"]) => ReturnType<typeof usePhotos>["photos"]> = {
  _favorites: (p) => p.filter((ph) => ph.favorited),
  _rated:     (p) => p.filter((ph) => (ph.rating ?? 0) > 0),
  _edited:    (p) => p.filter((ph) => ph.adjustments !== undefined),
  _5star:     (p) => p.filter((ph) => (ph.rating ?? 0) === 5),
  _recent:    (p) => { const w = Date.now() - 7 * 24 * 3600 * 1000; return p.filter((ph) => ph.timestamp >= w); },
  _red:       (p) => p.filter((ph) => ph.colorLabel === "red"),
  _orange:    (p) => p.filter((ph) => ph.colorLabel === "orange"),
  _green:     (p) => p.filter((ph) => ph.colorLabel === "green"),
};

export default function AlbumDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router  = useRouter();
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { photos } = usePhotos();
  const { albums }  = useAlbums();

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  const albumPhotos = useMemo(() => {
    if (!id) return [];
    const smartFn = SMART_FILTERS[id];
    if (smartFn) return smartFn([...photos]);
    const album = albums.find((a) => a.id === id);
    if (!album) return [];
    const idSet = new Set(album.photoIds);
    return photos.filter((p) => idSet.has(p.id));
  }, [id, photos, albums]);

  const displayName = name ?? albums.find((a) => a.id === id)?.name ?? "Album";
  const HEADER_H = topInset + 56;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/"); }}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {albumPhotos.length} photo{albumPhotos.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {albumPhotos.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="image" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No photos in this album</Text>
        </View>
      ) : (
        <PhotoGrid
          photos={albumPhotos}
          headerHeight={HEADER_H}
          columns={3}
          selectionMode={false}
          selectedIds={new Set()}
          onLongPress={() => {}}
          onToggleSelect={() => {}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
