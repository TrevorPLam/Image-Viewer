import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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

import { GridColumns, PhotoGrid } from "@/components/PhotoGrid";
import { useAlbums } from "@/context/AlbumsContext";
import { DEFAULT_ADJUSTMENTS, PhotoAdjustments, usePhotos } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";

type SortOrder = "newest" | "oldest";
type FilterMode = "all" | "favorites" | "picks" | "rejects";

const LABEL_COLORS: Record<string, string> = {
  red: "#ff453a", orange: "#ff9f0a", yellow: "#ffd60a",
  green: "#30d158", blue: "#0a84ff", purple: "#bf5af2",
};
const LABEL_KEYS = Object.keys(LABEL_COLORS);

const BUILT_IN_PRESETS = [
  { id: "bi_vivid",     name: "Vivid",     adjustments: { saturation: 25, vibrance: 20, contrast: 10, clarity: 15, dehaze: 8 } },
  { id: "bi_matte",     name: "Matte",     adjustments: { blacks: 18, whites: -8, contrast: -20, shadows: 12, brightness: 5 } },
  { id: "bi_bw",        name: "B&W",       adjustments: { saturation: -100, contrast: 10, clarity: 10 } },
  { id: "bi_cinema",    name: "Cinema",    adjustments: { toneMapping: 25, contrast: 18, shadows: -15, tint: 8, vignette: 35, blacks: -8 } },
  { id: "bi_warm",      name: "Warm",      adjustments: { warmth: 45, vibrance: 10 } },
  { id: "bi_cool",      name: "Cool",      adjustments: { warmth: -35, tint: -10, vibrance: 8 } },
  { id: "bi_landscape", name: "Landscape", adjustments: { dehaze: 20, saturation: 12, clarity: 18, shadows: 15, vibrance: 15 } },
  { id: "bi_moody",     name: "Moody",     adjustments: { contrast: 22, shadows: -25, blacks: -12, vignette: 45, clarity: 12 } },
];

export default function LibraryScreen() {
  const { photos, loading, deletePhotos, updatePhoto } = usePhotos();
  const { albums, createAlbum, addPhotosToAlbum } = useAlbums();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [sortOrder,     setSortOrder]     = useState<SortOrder>("newest");
  const [filterMode,    setFilterMode]    = useState<FilterMode>("all");
  const [minRating,     setMinRating]     = useState(0);
  const [labelFilter,   setLabelFilter]   = useState<string | null>(null);
  const [columns,       setColumns]       = useState<GridColumns>(3);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [showBatchEdit,   setShowBatchEdit]   = useState(false);
  const [newAlbumName,    setNewAlbumName]    = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamePrefix,    setRenamePrefix]    = useState("");
  const [showDuplicates,  setShowDuplicates]  = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const HEADER_HEIGHT = topInset + 120;

  const duplicateIds = useMemo(() => {
    const sorted = [...photos].sort((a, b) => a.timestamp - b.timestamp);
    const ids = new Set<string>();
    for (let i = 0; i < sorted.length - 1; i++) {
      if (Math.abs(sorted[i + 1].timestamp - sorted[i].timestamp) < 2000) {
        ids.add(sorted[i].id);
        ids.add(sorted[i + 1].id);
      }
    }
    return ids;
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    let list = [...photos];
    if (showDuplicates) list = list.filter((p) => duplicateIds.has(p.id));
    if (filterMode === "favorites") list = list.filter((p) => p.favorited);
    else if (filterMode === "picks")   list = list.filter((p) => p.flag === "pick");
    else if (filterMode === "rejects") list = list.filter((p) => p.flag === "reject");
    if (minRating > 0) list = list.filter((p) => (p.rating ?? 0) >= minRating);
    if (labelFilter)   list = list.filter((p) => p.colorLabel === labelFilter);
    return sortOrder === "newest"
      ? list.sort((a, b) => b.timestamp - a.timestamp)
      : list.sort((a, b) => a.timestamp - b.timestamp);
  }, [photos, sortOrder, filterMode, minRating, labelFilter, showDuplicates, duplicateIds]);

  const favCount    = useMemo(() => photos.filter((p) => p.favorited).length, [photos]);
  const picksCount  = useMemo(() => photos.filter((p) => p.flag === "pick").length, [photos]);
  const rejectsCount= useMemo(() => photos.filter((p) => p.flag === "reject").length, [photos]);

  const enterSelectionMode = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const count = selectedIds.size;
    const doDelete = async () => {
      if (Platform.OS !== "web") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await deletePhotos(Array.from(selectedIds));
      setSelectionMode(false);
      setSelectedIds(new Set());
    };
    if (Platform.OS === "web") { doDelete(); return; }
    Alert.alert(
      `Delete ${count} ${count === 1 ? "Photo" : "Photos"}`,
      `${count === 1 ? "This photo" : "These photos"} will be permanently deleted.`,
      [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: doDelete }]
    );
  }, [selectedIds, deletePhotos]);

  const handleAddToAlbum = useCallback(async (albumId: string) => {
    await addPhotosToAlbum(albumId, Array.from(selectedIds));
    setShowAlbumPicker(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [selectedIds, addPhotosToAlbum]);

  const handleCreateAndAdd = useCallback(async () => {
    if (!newAlbumName.trim()) return;
    const album = await createAlbum(newAlbumName.trim());
    await addPhotosToAlbum(album.id, Array.from(selectedIds));
    setNewAlbumName("");
    setShowAlbumPicker(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [newAlbumName, createAlbum, addPhotosToAlbum, selectedIds]);

  const handleBatchRename = useCallback(async () => {
    const prefix = renamePrefix.trim();
    if (!prefix) return;
    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i++) {
      await updatePhoto(ids[i], { name: `${prefix} ${i + 1}` });
    }
    setShowRenameModal(false);
    setRenamePrefix("");
    setSelectionMode(false);
    setSelectedIds(new Set());
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedIds, renamePrefix, updatePhoto]);

  const handleBatchApplyPreset = useCallback(async (presetAdj: Partial<PhotoAdjustments>) => {
    const ids = Array.from(selectedIds);
    const merged: PhotoAdjustments = { ...DEFAULT_ADJUSTMENTS, ...presetAdj };
    for (const pid of ids) {
      await updatePhoto(pid, { adjustments: merged });
    }
    setShowBatchEdit(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedIds, updatePhoto]);

  const handleFlagSelected = useCallback(async (flag: "pick" | "reject" | null) => {
    const ids = Array.from(selectedIds);
    for (const pid of ids) {
      await updatePhoto(pid, { flag });
    }
    setSelectionMode(false);
    setSelectedIds(new Set());
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedIds, updatePhoto]);

  const toggleSort    = useCallback(() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest")), []);
  const toggleColumns = useCallback(() => setColumns((c) => (c === 3 ? 2 : 3)), []);
  const toggleRating  = (r: number) => setMinRating((prev) => (prev === r ? 0 : r));
  const toggleLabel   = (l: string) => setLabelFilter((prev) => (prev === l ? null : l));

  const activeFilters = minRating > 0 || labelFilter !== null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset, backgroundColor: colors.background }]}>
        {selectionMode ? (
          <View style={styles.headerRow}>
            <Pressable onPress={cancelSelection} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })} hitSlop={8}>
              <Text style={[styles.actionBtn, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.selectionTitle, { color: colors.foreground }]}>
              {selectedIds.size === 0 ? "Select Photos" : `${selectedIds.size} Selected`}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              {selectedIds.size > 0 && (
                <>
                  <Pressable onPress={() => setShowBatchEdit(true)} hitSlop={8} style={{ padding: 4 }}>
                    <Feather name="sliders" size={19} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => setShowRenameModal(true)} hitSlop={8} style={{ padding: 4 }}>
                    <Feather name="type" size={19} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => handleFlagSelected("pick")} hitSlop={8} style={{ padding: 4 }}>
                    <Feather name="check-circle" size={19} color="#30d158" />
                  </Pressable>
                  <Pressable onPress={() => handleFlagSelected("reject")} hitSlop={8} style={{ padding: 4 }}>
                    <Feather name="x-circle" size={19} color="#ff453a" />
                  </Pressable>
                  <Pressable onPress={() => setShowAlbumPicker(true)} hitSlop={8}>
                    <Feather name="folder-plus" size={19} color={colors.primary} />
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={selectedIds.size > 0 ? handleDeleteSelected : undefined}
                style={({ pressed }) => ({ opacity: selectedIds.size === 0 ? 0.3 : pressed ? 0.6 : 1 })}
                hitSlop={8}
              >
                <Feather name="trash-2" size={19} color={colors.destructive} />
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Library</Text>
              <View style={styles.headerIcons}>
                <Pressable
                  onPress={() => filteredPhotos.length > 0 && router.push({ pathname: "/slideshow", params: { startId: filteredPhotos[0].id } })}
                  style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.secondary, opacity: filteredPhotos.length === 0 ? 0.3 : pressed ? 0.7 : 1 }]}
                  hitSlop={6}
                >
                  <Feather name="play" size={14} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={toggleColumns}
                  style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
                  hitSlop={6}
                >
                  <Feather name={columns === 3 ? "grid" : "maximize-2"} size={15} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={toggleSort}
                  style={({ pressed }) => [styles.sortBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
                  hitSlop={6}
                >
                  <Feather name={sortOrder === "newest" ? "arrow-down" : "arrow-up"} size={13} color={colors.foreground} />
                  <Text style={[styles.sortLabel, { color: colors.foreground }]}>
                    {sortOrder === "newest" ? "Newest" : "Oldest"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Pressable
                onPress={() => { setFilterMode("all"); setMinRating(0); setLabelFilter(null); }}
                style={[styles.filterChip, { backgroundColor: filterMode === "all" && !activeFilters ? colors.foreground : colors.secondary }]}
              >
                <Text style={[styles.filterChipText, { color: filterMode === "all" && !activeFilters ? colors.background : colors.mutedForeground }]}>
                  All  {photos.length}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilterMode((f) => (f === "favorites" ? "all" : "favorites"))}
                style={[styles.filterChip, { backgroundColor: filterMode === "favorites" ? "#ff2d55" : colors.secondary }]}
              >
                <Feather name="heart" size={12} color={filterMode === "favorites" ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.filterChipText, { color: filterMode === "favorites" ? "#fff" : colors.mutedForeground }]}>
                  Favorites  {favCount}
                </Text>
              </Pressable>

              {picksCount > 0 || filterMode === "picks" ? (
                <Pressable
                  onPress={() => setFilterMode((f) => (f === "picks" ? "all" : "picks"))}
                  style={[styles.filterChip, { backgroundColor: filterMode === "picks" ? "#30d158" : colors.secondary }]}
                >
                  <Feather name="check" size={12} color={filterMode === "picks" ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.filterChipText, { color: filterMode === "picks" ? "#fff" : colors.mutedForeground }]}>
                    Picks  {picksCount}
                  </Text>
                </Pressable>
              ) : null}

              {rejectsCount > 0 || filterMode === "rejects" ? (
                <Pressable
                  onPress={() => setFilterMode((f) => (f === "rejects" ? "all" : "rejects"))}
                  style={[styles.filterChip, { backgroundColor: filterMode === "rejects" ? "#ff453a" : colors.secondary }]}
                >
                  <Feather name="x" size={12} color={filterMode === "rejects" ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.filterChipText, { color: filterMode === "rejects" ? "#fff" : colors.mutedForeground }]}>
                    Rejects  {rejectsCount}
                  </Text>
                </Pressable>
              ) : null}

              {[1, 2, 3, 4, 5].map((r) => (
                <Pressable
                  key={r}
                  onPress={() => toggleRating(r)}
                  style={[styles.filterChip, { backgroundColor: minRating === r ? "#f5a623" : colors.secondary }]}
                >
                  <Text style={[styles.filterChipText, { color: minRating === r ? "#fff" : colors.mutedForeground }]}>
                    {"★".repeat(r)}
                  </Text>
                </Pressable>
              ))}

              {LABEL_KEYS.map((lk) => (
                <Pressable
                  key={lk}
                  onPress={() => toggleLabel(lk)}
                  style={[styles.filterChip, { backgroundColor: labelFilter === lk ? LABEL_COLORS[lk] : colors.secondary, paddingHorizontal: 10 }]}
                >
                  <View style={[styles.labelDot, { backgroundColor: labelFilter === lk ? "#fff" : LABEL_COLORS[lk] }]} />
                </Pressable>
              ))}

              {duplicateIds.size > 0 && (
                <Pressable
                  onPress={() => setShowDuplicates((v) => !v)}
                  style={[styles.filterChip, { backgroundColor: showDuplicates ? "#ff9f0a" : colors.secondary }]}
                >
                  <Feather name="copy" size={12} color={showDuplicates ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.filterChipText, { color: showDuplicates ? "#fff" : colors.mutedForeground }]}>
                    Dupes  {duplicateIds.size}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading…</Text>
        </View>
      ) : (
        <PhotoGrid
          photos={filteredPhotos}
          headerHeight={HEADER_HEIGHT}
          columns={columns}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onLongPress={enterSelectionMode}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* ── Add to Album Modal ── */}
      <Modal visible={showAlbumPicker} transparent animationType="slide" onRequestClose={() => setShowAlbumPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add to Album</Text>
              <Pressable onPress={() => setShowAlbumPicker(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={styles.newAlbumRow}>
              <TextInput
                style={[styles.newAlbumInput, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="New album name…"
                placeholderTextColor={colors.mutedForeground}
                value={newAlbumName}
                onChangeText={setNewAlbumName}
              />
              <Pressable
                onPress={handleCreateAndAdd}
                style={({ pressed }) => [styles.newAlbumBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.newAlbumBtnText}>Create</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {albums.length === 0 && (
                <Text style={[styles.emptyAlbums, { color: colors.mutedForeground }]}>No albums yet. Create one above.</Text>
              )}
              {albums.map((album) => (
                <Pressable
                  key={album.id}
                  onPress={() => handleAddToAlbum(album.id)}
                  style={({ pressed }) => [styles.albumRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="folder" size={18} color={colors.primary} />
                  <Text style={[styles.albumRowName, { color: colors.foreground }]}>{album.name}</Text>
                  <Text style={[styles.albumRowCount, { color: colors.mutedForeground }]}>
                    {album.photoIds.length} photo{album.photoIds.length !== 1 ? "s" : ""}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Batch Rename Modal ── */}
      <Modal visible={showRenameModal} transparent animationType="fade" onRequestClose={() => setShowRenameModal(false)}>
        <View style={[styles.modalOverlay, { justifyContent: "center", paddingHorizontal: 24 }]}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 6 }]}>Batch Rename</Text>
            <Text style={[styles.batchHint, { color: colors.mutedForeground, paddingHorizontal: 0, marginBottom: 14 }]}>
              Renames {selectedIds.size} photo{selectedIds.size !== 1 ? "s" : ""} as "{renamePrefix || "Photo"} 1", "{renamePrefix || "Photo"} 2", etc.
            </Text>
            <TextInput
              style={[styles.newAlbumInput, { color: colors.foreground, borderColor: colors.border, width: "100%", marginBottom: 16 }]}
              placeholder="Photo name prefix…"
              placeholderTextColor={colors.mutedForeground}
              value={renamePrefix}
              onChangeText={setRenamePrefix}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleBatchRename}
            />
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
              <Pressable
                onPress={() => setShowRenameModal(false)}
                style={({ pressed }) => [styles.newAlbumBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.newAlbumBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleBatchRename}
                style={({ pressed }) => [styles.newAlbumBtn, { backgroundColor: colors.primary, opacity: renamePrefix.trim() ? (pressed ? 0.7 : 1) : 0.4 }]}
              >
                <Text style={styles.newAlbumBtnText}>Rename</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Batch Edit Modal ── */}
      <Modal visible={showBatchEdit} transparent animationType="slide" onRequestClose={() => setShowBatchEdit(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Batch Edit — {selectedIds.size} Photos
              </Text>
              <Pressable onPress={() => setShowBatchEdit(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[styles.batchHint, { color: colors.mutedForeground }]}>
              Apply a preset to all {selectedIds.size} selected photos at once.
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {BUILT_IN_PRESETS.map((preset) => (
                <Pressable
                  key={preset.id}
                  onPress={() => handleBatchApplyPreset(preset.adjustments)}
                  style={({ pressed }) => [styles.batchPresetRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={styles.batchPresetSwatch} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.batchPresetName, { color: colors.foreground }]}>{preset.name}</Text>
                    <Text style={[styles.batchPresetDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {Object.entries(preset.adjustments).map(([k, v]) => `${k}: ${v > 0 ? "+" : ""}${v}`).join(" · ")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
              <Pressable
                onPress={() => handleBatchApplyPreset({ exposure: 0, brightness: 5, contrast: 12, highlights: -20, shadows: 20, whites: 8, blacks: -8, vibrance: 12, clarity: 8, dehaze: 5 })}
                style={({ pressed }) => [styles.batchPresetRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={[styles.batchPresetSwatch, { backgroundColor: "#a78bfa22", borderColor: "#a78bfa" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.batchPresetName, { color: "#a78bfa" }]}>AI Enhance (All)</Text>
                  <Text style={[styles.batchPresetDesc, { color: colors.mutedForeground }]}>Smart auto-tone for every selected photo</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  sortLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  filterRow: { flexDirection: "row", gap: 8, paddingTop: 4, paddingBottom: 4 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  labelDot: { width: 10, height: 10, borderRadius: 5 },
  selectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  actionBtn: { fontSize: 16, fontFamily: "Inter_400Regular" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  newAlbumRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  newAlbumInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  newAlbumBtn: { height: 40, paddingHorizontal: 16, borderRadius: 10, justifyContent: "center" },
  newAlbumBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyAlbums: { textAlign: "center", paddingVertical: 24, fontSize: 14, fontFamily: "Inter_400Regular" },
  albumRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  albumRowName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  albumRowCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  batchHint: { fontSize: 13, fontFamily: "Inter_400Regular", paddingHorizontal: 20, marginBottom: 8 },
  batchPresetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  batchPresetSwatch: { width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  batchPresetName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  batchPresetDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
