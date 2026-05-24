import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Photo } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GAP = 2;

export type GridColumns = 2 | 3;

interface Props {
  photos: Photo[];
  headerHeight: number;
  columns: GridColumns;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onLongPress: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

function EmptyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.empty, { backgroundColor: colors.background }]}>
      <Feather name="image" size={52} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Photos Yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Tap the Add tab to take or import photos
      </Text>
    </View>
  );
}

export function PhotoGrid({
  photos,
  headerHeight,
  columns,
  selectionMode,
  selectedIds,
  onLongPress,
  onToggleSelect,
}: Props) {
  const colors = useColors();
  const router = useRouter();

  const tileSize = (SCREEN_WIDTH - GAP * (columns - 1)) / columns;

  const renderItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => {
      const col = index % columns;
      const marginLeft = col === 0 ? 0 : GAP;
      const isSelected = selectedIds.has(item.id);

      const handlePress = () => {
        if (selectionMode) {
          onToggleSelect(item.id);
        } else {
          router.push(`/photo/${item.id}`);
        }
      };

      return (
        <Pressable
          onPress={handlePress}
          onLongPress={() => onLongPress(item.id)}
          delayLongPress={350}
          style={({ pressed }) => [
            { width: tileSize, height: tileSize, marginLeft, position: "relative" as const },
            { opacity: pressed && !selectionMode ? 0.82 : 1 },
          ]}
        >
          <Image
            source={{ uri: item.uri }}
            style={[
              { width: tileSize, height: tileSize },
              selectionMode && !isSelected && styles.tileUnselected,
            ]}
            contentFit="cover"
            transition={150}
          />

          {item.favorited && !selectionMode && (
            <View style={styles.favBadge}>
              <Feather name="heart" size={10} color="#fff" />
            </View>
          )}

          {selectionMode && (
            <View style={styles.checkOverlay}>
              <View
                style={[
                  styles.checkCircle,
                  isSelected
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: "rgba(0,0,0,0.25)", borderColor: "rgba(255,255,255,0.9)" },
                ]}
              >
                {isSelected && <Feather name="check" size={13} color="#fff" />}
              </View>
            </View>
          )}
        </Pressable>
      );
    },
    [router, selectionMode, selectedIds, onLongPress, onToggleSelect, colors, tileSize, columns]
  );

  const keyExtractor = useCallback((item: Photo) => item.id, []);

  if (photos.length === 0) {
    return <EmptyState colors={colors} />;
  }

  const bottomPad = Platform.OS === "web" ? 34 : 100;

  return (
    <FlatList
      data={photos}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={columns}
      key={`grid-${columns}`}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[
        styles.list,
        { paddingTop: headerHeight + 4, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  row: { gap: 0 },
  tileUnselected: { opacity: 0.55 },
  favBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,45,85,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOverlay: {
    position: "absolute",
    top: 6,
    left: 6,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
