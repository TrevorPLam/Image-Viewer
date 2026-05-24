import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Photo {
  id: string;
  uri: string;
  timestamp: number;
  width?: number;
  height?: number;
  favorited?: boolean;
}

interface PhotosContextValue {
  photos: Photo[];
  addPhoto: (uri: string, width?: number, height?: number) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  deletePhotos: (ids: string[]) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  loading: boolean;
}

const PhotosContext = createContext<PhotosContextValue | null>(null);

const STORAGE_KEY = "@photos_app_v1";
const SEEDED_KEY = "@photos_app_seeded_v1";

const now = Date.now();
const DAY = 86_400_000;

const SEED_PHOTOS: Photo[] = [
  { id: "seed_1",  uri: "https://picsum.photos/id/10/900/1200",  timestamp: now - 2 * DAY },
  { id: "seed_2",  uri: "https://picsum.photos/id/15/900/1100",  timestamp: now - 3 * DAY },
  { id: "seed_3",  uri: "https://picsum.photos/id/24/900/1200",  timestamp: now - 5 * DAY },
  { id: "seed_4",  uri: "https://picsum.photos/id/37/900/1100",  timestamp: now - 8 * DAY },
  { id: "seed_5",  uri: "https://picsum.photos/id/65/900/1200",  timestamp: now - 11 * DAY },
  { id: "seed_6",  uri: "https://picsum.photos/id/82/900/1100",  timestamp: now - 14 * DAY },
  { id: "seed_7",  uri: "https://picsum.photos/id/91/900/1200",  timestamp: now - 18 * DAY },
  { id: "seed_8",  uri: "https://picsum.photos/id/103/900/1100", timestamp: now - 22 * DAY },
  { id: "seed_9",  uri: "https://picsum.photos/id/119/900/1200", timestamp: now - 27 * DAY },
];

export function PhotosProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [raw, seeded] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SEEDED_KEY),
        ]);

        let initial: Photo[] = raw ? JSON.parse(raw) : [];

        if (!seeded) {
          initial = [...SEED_PHOTOS, ...initial];
          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial)),
            AsyncStorage.setItem(SEEDED_KEY, "1"),
          ]);
        }

        setPhotos(initial);
      } catch {
        // ignore storage errors
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const persist = useCallback(async (next: Photo[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addPhoto = useCallback(
    async (uri: string, width?: number, height?: number) => {
      const photo: Photo = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        uri,
        timestamp: Date.now(),
        width,
        height,
      };
      setPhotos((prev) => {
        const next = [photo, ...prev];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const deletePhoto = useCallback(
    async (id: string) => {
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const deletePhotos = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      setPhotos((prev) => {
        const next = prev.filter((p) => !idSet.has(p.id));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      setPhotos((prev) => {
        const next = prev.map((p) =>
          p.id === id ? { ...p, favorited: !p.favorited } : p
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <PhotosContext.Provider
      value={{ photos, addPhoto, deletePhoto, deletePhotos, toggleFavorite, loading }}
    >
      {children}
    </PhotosContext.Provider>
  );
}

export function usePhotos(): PhotosContextValue {
  const ctx = useContext(PhotosContext);
  if (!ctx) throw new Error("usePhotos must be used inside PhotosProvider");
  return ctx;
}
