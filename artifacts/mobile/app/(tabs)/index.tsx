import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GridColumns, PhotoGrid } from "@/components/PhotoGrid";
import { usePhotos } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";

type SortOrder = "newest" | "oldest";
type FilterMode = "all" | "favorites";

export default function LibraryScreen() {
  const { photos, loading, deletePhotos } = usePhotos();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [columns, setColumns] = useState<GridColumns>(3);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const HEADER_HEIGHT = topInset + 88;

  const filteredPhotos = useMemo(() => {
    let list = filterMode === "favorites"
      ? photos.filter((p) => p.favorited)
      : [...photos];
    return sortOrder === "newest"
      ? list.sort((a, b) => b.timestamp - a.timestamp)
      : list.sort((a, b) => a.timestamp - b.timestamp);
  }, [photos, sortOrder, filterMode]);

  const favCount = useMemo(() => photos.filter((p) => p.favorited).length, [photos]);

  const enterSelectionMode = useCallback((id: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
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
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      await deletePhotos(Array.from(selectedIds));
      setSelectionMode(false);
      setSelectedIds(new Set());
    };
    if (Platform.OS === "web") { doDelete(); return; }
    Alert.alert(
      `Delete ${count} ${count === 1 ? "Photo" : "Photos"}`,
      `${count === 1 ? "This photo" : "These photos"} will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]
    );
  }, [selectedIds, deletePhotos]);

  const toggleSort = useCallback(() => {
    setSortOrder((s) => (s === "newest" ? "oldest" : "newest"));
  }, []);

  const toggleColumns = useCallback(() => {
    setColumns((c) => (c === 3 ? 2 : 3));
  }, []);

  const toggleFilter = useCallback(() => {
    setFilterMode((f) => (f === "all" ? "favorites" : "all"));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topInset,
            backgroundColor: colors.background,
          },
        ]}
      >
        {selectionMode ? (
          <View style={styles.headerRow}>
            <Pressable
              onPress={cancelSelection}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              hitSlop={8}
            >
              <Text style={[styles.actionBtn, { color: colors.primary }]}>Cancel</Text>
            </Pressable>

            <Text style={[styles.selectionTitle, { color: colors.foreground }]}>
              {selectedIds.size === 0 ? "Select Photos" : `${selectedIds.size} Selected`}
            </Text>

            <Pressable
              onPress={selectedIds.size > 0 ? handleDeleteSelected : undefined}
              style={({ pressed }) => ({
                opacity: selectedIds.size === 0 ? 0.3 : pressed ? 0.6 : 1,
              })}
              hitSlop={8}
            >
              <Feather name="trash-2" size={20} color={colors.destructive} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Library
              </Text>
              <View style={styles.headerIcons}>
                <Pressable
                  onPress={toggleColumns}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                  ]}
                  hitSlop={6}
                >
                  <Feather
                    name={columns === 3 ? "grid" : "maximize-2"}
                    size={15}
                    color={colors.foreground}
                  />
                </Pressable>
                <Pressable
                  onPress={toggleSort}
                  style={({ pressed }) => [
                    styles.sortBtn,
                    { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                  ]}
                  hitSlop={6}
                >
                  <Feather
                    name={sortOrder === "newest" ? "arrow-down" : "arrow-up"}
                    size={13}
                    color={colors.foreground}
                  />
                  <Text style={[styles.sortLabel, { color: colors.foreground }]}>
                    {sortOrder === "newest" ? "Newest" : "Oldest"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setFilterMode("all")}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      filterMode === "all" ? colors.foreground : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color:
                        filterMode === "all" ? colors.background : colors.mutedForeground,
                    },
                  ]}
                >
                  All  {photos.length}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilterMode("favorites")}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      filterMode === "favorites" ? "#ff2d55" : colors.secondary,
                  },
                ]}
              >
                <Feather
                  name="heart"
                  size={12}
                  color={filterMode === "favorites" ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color:
                        filterMode === "favorites" ? "#fff" : colors.mutedForeground,
                    },
                  ]}
                >
                  Favorites  {favCount}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading…
          </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sortLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 4,
    paddingBottom: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  selectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  actionBtn: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
