import { create } from "zustand";
import type { UserProfile } from "@/shared/api/types";

interface AppState {
  user: UserProfile | null;
  setUser: (user: UserProfile) => void;
  selectedObjectId: number | null;
  setSelectedObjectId: (id: number | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  selectedObjectId: null,
  setSelectedObjectId: (id) => set({ selectedObjectId: id }),
}));
