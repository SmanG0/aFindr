"use client";

import { usePathname } from "next/navigation";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ReactNode } from "react";

export function ConditionalConvexProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWaitlist = pathname?.startsWith("/waitlist");

  if (isWaitlist) {
    return <>{children}</>;
  }
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
