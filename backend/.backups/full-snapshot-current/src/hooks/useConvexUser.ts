"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "../../convex/_generated/dataModel";

const DEVICE_ID_KEY = "afindr_device_id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function useConvexUser() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const getOrCreate = useMutation(api.users.getOrCreate);

  useEffect(() => {
    const deviceId = getDeviceId();
    if (!deviceId) return;

    getOrCreate({ deviceId })
      .then((id) => {
        setUserId(id);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to create/get Convex user:", err);
        setIsLoading(false);
      });
  }, [getOrCreate]);

  return { userId, isLoading };
}
