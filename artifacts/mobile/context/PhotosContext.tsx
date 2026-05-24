import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Photo {
  id: string;
  uri: string;
  timestamp: number;
  width?: number;
  height?: number;
}

interface PhotosContextValue {
  photos: Photo[];
  addPhoto: (uri: string, width?: number, height?: number) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  deletePhotos: (ids: string[]) => Promise<void>;
  loading: boolean;
}

const PhotosContext = createContext<PhotosContextValue | null>(null);

const STORAGE_KEY = "@photos_app_v1";

export function PhotosProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed: Photo[] = JSON.parse(raw);
          setPhotos(parsed);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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

  return (
    <PhotosContext.Provider value={{ photos, addPhoto, deletePhoto, deletePhotos, loading }}>
      {children}
    </PhotosContext.Provider>
  );
}

export function usePhotos(): PhotosContextValue {
  const ctx = useContext(PhotosContext);
  if (!ctx) throw new Error("usePhotos must be used inside PhotosProvider");
  return ctx;
}
