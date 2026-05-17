"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type AdminStore = {
  isAdmin: boolean;
  setAdmin: (value: boolean) => void;
};

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      isAdmin: false,
      setAdmin: (value) => set({ isAdmin: value })
    }),
    { name: "techsouls-admin-mode" }
  )
);
