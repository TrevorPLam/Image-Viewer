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
const NUM_COLUMNS = 3;
const GAP = 2;
const TILE_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface Props {
  photos: Photo[];
  onAddPress: () => void;
  headerHeight: number;
}

function EmptyState({ onAddPress, colors }: { onAddPress: () => void; colors: ReturnType<typeof useColors> }) {
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

export function PhotoGrid({ photos, onAddPress, headerHeight }: Props) {
  const colors = useColors();
  const router = useRouter();

  const renderItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => {
      const col = index % NUM_COLUMNS;
      const marginLeft = col === 0 ? 0 : GAP;
      return (
        <Pressable
          onPress={() => router.push(`/photo/${item.id}`)}
          style={({ pressed }) => [
            styles.tile,
            { marginLeft, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Image
            source={{ uri: item.uri }}
            style={styles.tileImage}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      );
    },
    [router]
  );

  const keyExtractor = useCallback((item: Photo) => item.id, []);

  if (photos.length === 0) {
    return <EmptyState onAddPress={onAddPress} colors={colors} />;
  }

  const bottomPad = Platform.OS === "web" ? 34 : 100;

  return (
    <FlatList
      data={photos}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[
        styles.list,
        { paddingTop: headerHeight + 4, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!!photos.length}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: GAP,
  },
  row: {
    gap: 0,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  tileImage: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
