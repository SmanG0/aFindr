"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, createContext, useContext } from "react";
import { useConvexUser } from "@/hooks/useConvexUser";
import type { Id } from "../../convex/_generated/dataModel";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ── Convex User Context ──
// Provides userId app-wide so each component doesn't need to call getOrCreate independently

interface ConvexUserContextValue {
  userId: Id<"users"> | null;
  isLoading: boolean;
}

const ConvexUserContext = createContext<ConvexUserContextValue>({
  userId: null,
  isLoading: true,
});

export function useConvexUserId() {
  return useContext(ConvexUserContext);
}

function ConvexUserProvider({ children }: { children: ReactNode }) {
  const { userId, isLoading } = useConvexUser();
  return (
    <ConvexUserContext.Provider value={{ userId, isLoading }}>
      {children}
    </ConvexUserContext.Provider>
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexUserProvider>{children}</ConvexUserProvider>
    </ConvexProvider>
  );
}
