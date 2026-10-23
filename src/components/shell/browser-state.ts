"use client";

import { useCallback, useSyncExternalStore } from "react";

const changeEvent = "orbita:preferences-changed";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changeEvent, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(changeEvent, listener); };
}

export function storePreference(key: string, value: string) {
  try {
    if (localStorage.getItem(key) === value) return;
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event(changeEvent));
  } catch {}
}

export function useStoredPreference(key: string, fallback: string) {
  const snapshot = useCallback(() => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }, [key, fallback]);
  return useSyncExternalStore(subscribe, snapshot, () => fallback);
}

function subscribeScroll(listener: () => void) {
  window.addEventListener("scroll", listener, { passive: true });
  return () => window.removeEventListener("scroll", listener);
}
const scrollSnapshot = () => window.scrollY > 12;
const serverScroll = () => false;
export function useScrolled() { return useSyncExternalStore(subscribeScroll, scrollSnapshot, serverScroll); }
