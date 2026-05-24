import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface SmartAlbumFilter {
  favorites?: boolean;
  minRating?: number;
  colorLabel?: string;
  hasEdits?: boolean;
}

export interface Album {
  id: string;
  name: string;
  photoIds: string[];
  createdAt: number;
  smart?: SmartAlbumFilter;
  cover?: string;
}

interface AlbumsContextValue {
  albums: Album[];
  createAlbum: (name: string) => Promise<Album>;
  deleteAlbum: (id: string) => Promise<void>;
  renameAlbum: (id: string, name: string) => Promise<void>;
  addPhotosToAlbum: (albumId: string, photoIds: string[]) => Promise<void>;
  removePhotoFromAlbum: (albumId: string, photoId: string) => Promise<void>;
  reorderAlbum: (id: string, direction: "up" | "down") => Promise<void>;
  loading: boolean;
}

const AlbumsContext = createContext<AlbumsContextValue | null>(null);

const STORAGE_KEY = "@photos_albums_v1";

export function AlbumsProvider({ children }: { children: React.ReactNode }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setAlbums(JSON.parse(raw));
      } catch {
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const persist = useCallback(async (next: Album[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const createAlbum = useCallback(
    async (name: string): Promise<Album> => {
      const album: Album = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        name: name.trim(),
        photoIds: [],
        createdAt: Date.now(),
      };
      setAlbums((prev) => {
        const next = [...prev, album];
        persist(next);
        return next;
      });
      return album;
    },
    [persist]
  );

  const deleteAlbum = useCallback(
    async (id: string) => {
      setAlbums((prev) => {
        const next = prev.filter((a) => a.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const renameAlbum = useCallback(
    async (id: string, name: string) => {
      setAlbums((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, name: name.trim() } : a));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const addPhotosToAlbum = useCallback(
    async (albumId: string, photoIds: string[]) => {
      setAlbums((prev) => {
        const next = prev.map((a) => {
          if (a.id !== albumId) return a;
          const ids = new Set([...a.photoIds, ...photoIds]);
          return { ...a, photoIds: Array.from(ids) };
        });
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removePhotoFromAlbum = useCallback(
    async (albumId: string, photoId: string) => {
      setAlbums((prev) => {
        const next = prev.map((a) =>
          a.id === albumId ? { ...a, photoIds: a.photoIds.filter((id) => id !== photoId) } : a
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const reorderAlbum = useCallback(
    async (id: string, direction: "up" | "down") => {
      setAlbums((prev) => {
        const idx = prev.findIndex((a) => a.id === id);
        if (idx < 0) return prev;
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <AlbumsContext.Provider
      value={{ albums, createAlbum, deleteAlbum, renameAlbum, addPhotosToAlbum, removePhotoFromAlbum, reorderAlbum, loading }}
    >
      {children}
    </AlbumsContext.Provider>
  );
}

export function useAlbums(): AlbumsContextValue {
  const ctx = useContext(AlbumsContext);
  if (!ctx) throw new Error("useAlbums must be used inside AlbumsProvider");
  return ctx;
}
