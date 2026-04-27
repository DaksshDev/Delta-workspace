import { create } from "zustand";

type Mode = "study" | "dev";

interface AppState {
  mode: Mode;
  setMode: (mode: Mode) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: "study",
  setMode: (mode) => set({ mode }),
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
