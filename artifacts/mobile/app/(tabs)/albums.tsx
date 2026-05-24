import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAlbums } from "@/context/AlbumsContext";
import { usePhotos } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";

const LABEL_COLORS: Record<string, string> = {
  red: "#ff453a", orange: "#ff9f0a", yellow: "#ffd60a",
  green: "#30d158", blue: "#0a84ff", purple: "#bf5af2",
};

interface SmartAlbum {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  filter: (photos: ReturnType<typeof usePhotos>["photos"]) => ReturnType<typeof usePhotos>["photos"];
}

const SMART_ALBUMS: SmartAlbum[] = [
  {
    id: "_favorites",
    name: "Favorites",
    icon: "heart",
    iconColor: "#ff2d55",
    filter: (photos) => photos.filter((p) => p.favorited),
  },
  {
    id: "_picks",
    name: "Picks",
    icon: "check-circle",
    iconColor: "#30d158",
    filter: (photos) => photos.filter((p) => p.flag === "pick"),
  },
  {
    id: "_rejects",
    name: "Rejects",
    icon: "x-circle",
    iconColor: "#ff453a",
    filter: (photos) => photos.filter((p) => p.flag === "reject"),
  },
  {
    id: "_rated",
    name: "Rated",
    icon: "star",
    iconColor: "#f5a623",
    filter: (photos) => photos.filter((p) => (p.rating ?? 0) > 0),
  },
  {
    id: "_edited",
    name: "Edited",
    icon: "sliders",
    iconColor: "#30d158",
    filter: (photos) => photos.filter((p) => p.adjustments !== undefined),
  },
  {
    id: "_5star",
    name: "5 Stars",
    icon: "award",
    iconColor: "#ffd60a",
    filter: (photos) => photos.filter((p) => (p.rating ?? 0) === 5),
  },
  {
    id: "_recent",
    name: "Recent",
    icon: "clock",
    iconColor: "#0a84ff",
    filter: (photos) => {
      const week = Date.now() - 7 * 24 * 3600 * 1000;
      return photos.filter((p) => p.timestamp >= week);
    },
  },
  { id: "_red",    name: "Red Label",    icon: "tag", iconColor: LABEL_COLORS.red,    filter: (p) => p.filter((ph) => ph.colorLabel === "red") },
  { id: "_orange", name: "Orange Label", icon: "tag", iconColor: LABEL_COLORS.orange, filter: (p) => p.filter((ph) => ph.colorLabel === "orange") },
  { id: "_green",  name: "Green Label",  icon: "tag", iconColor: LABEL_COLORS.green,  filter: (p) => p.filter((ph) => ph.colorLabel === "green") },
];

function AlbumTile({ cover, name, count, onPress, onDelete }: {
  cover?: string; name: string; count: number;
  onPress: () => void; onDelete?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.tileCover, { backgroundColor: colors.secondary }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.tileCoverImg} contentFit="cover" />
        ) : (
          <Feather name="image" size={28} color={colors.mutedForeground} />
        )}
        {onDelete && (
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
            style={styles.deleteBtn}
            hitSlop={6}
          >
            <Feather name="x" size={12} color="#fff" />
          </Pressable>
        )}
      </View>
      <Text style={[styles.tileName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
      <Text style={[styles.tileCount, { color: colors.mutedForeground }]}>{count} photo{count !== 1 ? "s" : ""}</Text>
    </Pressable>
  );
}

export default function AlbumsScreen() {
  const router    = useRouter();
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { photos } = usePhotos();
  const { albums, createAlbum, deleteAlbum } = useAlbums();

  const [showCreate,   setShowCreate]   = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [creating, setCreating] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const smartAlbumsWithCounts = useMemo(
    () => SMART_ALBUMS.map((sa) => ({ ...sa, photos: sa.filter(photos) })),
    [photos]
  );

  const userAlbumsWithCovers = useMemo(
    () =>
      albums.map((album) => {
        const firstId = album.photoIds[0];
        const cover = photos.find((p) => p.id === firstId)?.uri;
        return { ...album, cover };
      }),
    [albums, photos]
  );

  const handleCreate = async () => {
    if (!newAlbumName.trim() || creating) return;
    setCreating(true);
    await createAlbum(newAlbumName.trim());
    setNewAlbumName("");
    setShowCreate(false);
    setCreating(false);
  };

  const confirmDelete = (id: string, name: string) => {
    if (Platform.OS === "web") { deleteAlbum(id); return; }
    Alert.alert(`Delete "${name}"?`, "This will remove the album but not the photos.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteAlbum(id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Albums</Text>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
          hitSlop={6}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Smart Albums */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Smart Albums</Text>
        <View style={styles.grid}>
          {smartAlbumsWithCounts.map(({ id, name, icon, iconColor, photos: sa }) => (
            <Pressable
              key={id}
              onPress={() => router.push({ pathname: "/album/[id]", params: { id, name } })}
              style={({ pressed }) => [styles.smartTile, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.smartIcon, { backgroundColor: iconColor + "22" }]}>
                <Feather name={icon as never} size={20} color={iconColor} />
              </View>
              <Text style={[styles.smartName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.smartCount, { color: colors.mutedForeground }]}>{sa.length}</Text>
            </Pressable>
          ))}
        </View>

        {/* My Albums */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>My Albums</Text>
        </View>

        {userAlbumsWithCovers.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="folder" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No albums yet</Text>
            <Pressable
              onPress={() => setShowCreate(true)}
              style={({ pressed }) => [styles.emptyBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.emptyBtnText}>Create Album</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {userAlbumsWithCovers.map((album) => (
              <AlbumTile
                key={album.id}
                cover={album.cover}
                name={album.name}
                count={album.photoIds.length}
                onPress={() => router.push({ pathname: "/album/[id]", params: { id: album.id, name: album.name } })}
                onDelete={() => confirmDelete(album.id, album.name)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Album Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreate(false)}>
          <Pressable style={[styles.createCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.createTitle, { color: colors.foreground }]}>New Album</Text>
            <TextInput
              style={[styles.createInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Album name"
              placeholderTextColor={colors.mutedForeground}
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              autoFocus
              onSubmitEditing={handleCreate}
            />
            <View style={styles.createBtns}>
              <Pressable
                onPress={() => { setShowCreate(false); setNewAlbumName(""); }}
                style={({ pressed }) => [styles.createCancelBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.createCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                style={({ pressed }) => [styles.createConfirmBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.createConfirmText}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, paddingVertical: 6 },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10, marginTop: 8 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  smartTile: { width: "47%", borderRadius: 14, padding: 14, gap: 8, flexDirection: "row", alignItems: "center" },
  smartIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  smartName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  smartCount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tile: { width: "47%" },
  tileCover: { width: "100%", aspectRatio: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" },
  tileCoverImg: { width: "100%", height: "100%" },
  deleteBtn: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  tileName: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 6, marginBottom: 1 },
  tileCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  createCard: { width: 300, borderRadius: 16, padding: 20, gap: 14 },
  createTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  createInput: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  createBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  createCancelBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  createCancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  createConfirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  createConfirmText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
