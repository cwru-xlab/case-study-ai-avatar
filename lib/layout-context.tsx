"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface LayoutContextType {
  fullScreen: boolean;
  setFullScreen: (value: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType>({
  fullScreen: false,
  setFullScreen: () => {},
});

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [fullScreen, setFullScreen] = useState(false);

  return (
    <LayoutContext.Provider value={{ fullScreen, setFullScreen }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
