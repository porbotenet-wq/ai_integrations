import { useCallback, useEffect, useState } from "react";

const DB_NAME = "stsphera-offline";
const DB_VERSION = 1;
const STORE_NAME = "project-cache";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function setItem(key: string, data: unknown) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ key, data, ts: Date.now() });
  return new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function getItem<T>(key: string): Promise<{ data: T; ts: number } | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).get(key);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export function useOfflineCache() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const cacheProjectData = useCallback(async (projectId: string) => {
    if (!navigator.onLine) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const [proj, alerts, crews, mats, pf] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("alerts").select("*").eq("project_id", projectId).limit(50),
        supabase.from("crews").select("*").eq("project_id", projectId),
        supabase.from("materials").select("*").eq("project_id", projectId),
        supabase.from("plan_fact").select("*").eq("project_id", projectId).order("date", { ascending: false }).limit(30),
      ]);
      await setItem(`project:${projectId}`, {
        project: proj.data,
        alerts: alerts.data,
        crews: crews.data,
        materials: mats.data,
        planFact: pf.data,
      });
    } catch (e) {
      console.warn("Offline cache failed:", e);
    }
  }, []);

  const getCachedProject = useCallback(async (projectId: string) => {
    try {
      const result = await getItem<any>(`project:${projectId}`);
      return result;
    } catch {
      return null;
    }
  }, []);

  return { isOnline, cacheProjectData, getCachedProject, setItem, getItem };
}
