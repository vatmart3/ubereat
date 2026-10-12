"use client";
import { createStore, del, get, set, values } from "idb-keyval";
import type { Draft, QueuedHandover } from "./types";

const draftStore = typeof indexedDB !== "undefined" ? createStore("remis-drafts", "drafts") : undefined;
const queueStore = typeof indexedDB !== "undefined" ? createStore("remis-queue", "queue") : undefined;

const CURRENT = "current";

export async function loadDraft(): Promise<Draft | null> {
  if (!draftStore) return null;
  try {
    return ((await get<Draft>(CURRENT, draftStore)) ?? null) as Draft | null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: Draft): Promise<void> {
  if (!draftStore) return;
  try {
    await set(CURRENT, { ...draft, updated_at: new Date().toISOString() }, draftStore);
  } catch {
    /* quota ou navigation privée : le brouillon reste en mémoire */
  }
}

export async function clearDraft(): Promise<void> {
  if (!draftStore) return;
  try {
    await del(CURRENT, draftStore);
  } catch {}
}

export async function enqueue(item: QueuedHandover): Promise<void> {
  if (!queueStore) throw new Error("Stockage hors ligne indisponible sur cet appareil");
  await set(item.id, item, queueStore);
  notifyQueueChange();
}

export async function listQueue(): Promise<QueuedHandover[]> {
  if (!queueStore) return [];
  try {
    return ((await values<QueuedHandover>(queueStore)) ?? []).sort((a, b) => a.queued_at.localeCompare(b.queued_at));
  } catch {
    return [];
  }
}

export async function updateQueued(item: QueuedHandover): Promise<void> {
  if (!queueStore) return;
  await set(item.id, item, queueStore);
  notifyQueueChange();
}

export async function removeQueued(id: string): Promise<void> {
  if (!queueStore) return;
  await del(id, queueStore);
  notifyQueueChange();
}

export const QUEUE_EVENT = "remis:queue";
function notifyQueueChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}
