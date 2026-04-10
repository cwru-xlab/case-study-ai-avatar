"use client";

import { ReactNode } from "react";
import clsx from "clsx";
import { useLayout } from "@/lib/layout-context";

export function MainContent({ children }: { children: ReactNode }) {
  const { fullScreen } = useLayout();

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <main
        className={clsx(
          "flex-1",
          fullScreen ? "overflow-hidden" : "overflow-y-auto container mx-auto max-w-7xl pt-6 px-6"
        )}
      >
        {children}
      </main>
      {!fullScreen && (
        <footer className="w-full flex items-center justify-center py-3 shrink-0" />
      )}
    </div>
  );
}
