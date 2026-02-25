"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useConvexUser";
import { useCallback } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export interface JournalEntry {
  _id: Id<"journalEntries">;
  date: string;
  title: string;
  market?: string;
  outcome?: "win" | "loss" | "breakeven";
  mmxm?: string;
  tradeBreakdown?: string;
  risk?: number;
  returnVal?: number;
  body: string;
  mood?: "bullish" | "bearish" | "neutral";
  screenshotIds: Id<"_storage">[];
  commentsJson: string;
  createdAt: number;
  updatedAt: number;
}

export function useJournal() {
  const { isAuthenticated } = useCurrentUser();

  const raw = useQuery(api.journal.list, isAuthenticated ? {} : "skip");
  const createMutation = useMutation(api.journal.create);
  const updateMutation = useMutation(api.journal.update);
  const removeMutation = useMutation(api.journal.remove);
  const generateUploadUrlMutation = useMutation(api.journal.generateUploadUrl);

  const entries: JournalEntry[] = (raw ?? []) as JournalEntry[];
  const isLoading = raw === undefined && isAuthenticated;

  const createEntry = useCallback(async () => {
    if (!isAuthenticated) return;
    return await createMutation({
      date: new Date().toISOString(),
      title: "",
      body: "",
    });
  }, [isAuthenticated, createMutation]);

  const updateEntry = useCallback(
    async (
      id: Id<"journalEntries">,
      patch: Partial<Omit<JournalEntry, "_id" | "createdAt" | "updatedAt">>,
    ) => {
      if (!isAuthenticated) return;
      await updateMutation({ id, ...patch });
    },
    [isAuthenticated, updateMutation],
  );

  const removeEntry = useCallback(
    async (id: Id<"journalEntries">) => {
      if (!isAuthenticated) return;
      await removeMutation({ id });
    },
    [isAuthenticated, removeMutation],
  );

  const uploadScreenshot = useCallback(
    async (blob: Blob): Promise<Id<"_storage"> | null> => {
      if (!isAuthenticated) return null;
      const uploadUrl = await generateUploadUrlMutation();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      const { storageId } = await res.json();
      return storageId as Id<"_storage">;
    },
    [isAuthenticated, generateUploadUrlMutation],
  );

  return {
    entries,
    isLoading,
    createEntry,
    updateEntry,
    removeEntry,
    uploadScreenshot,
  };
}
