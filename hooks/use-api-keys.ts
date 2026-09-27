"use client";

import { useEffect, useState } from "react";
import { ApiKeys, getKeys, hydrateKeys } from "@/lib/key-storage";

export function useApiKeys(): { keys: ApiKeys; keyVersion: number } {
  const [keys, setKeys] = useState<ApiKeys>({});
  const [keyVersion, setKeyVersion] = useState(0);

  useEffect(() => {
    const refreshKeys = () => {
      setKeys(getKeys());
      setKeyVersion((version) => version + 1);
    };
    refreshKeys();
    void hydrateKeys().then(refreshKeys);
    window.addEventListener("keys-updated", refreshKeys);
    return () => window.removeEventListener("keys-updated", refreshKeys);
  }, []);

  return { keys, keyVersion };
}
