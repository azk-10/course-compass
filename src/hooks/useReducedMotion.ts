import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cc:reduced-motion";

/**
 * Reduced-motion preference: seeded from the OS setting, overridable in-app and
 * remembered. Applies `data-reduced-motion` on <html> so CSS (and the ripple)
 * can opt out of animation globally.
 */
export function useReducedMotion(): [boolean, (value: boolean) => void] {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true" || stored === "false") {
      setReduced(stored === "true");
      return;
    }
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    document.documentElement.dataset["reducedMotion"] = String(reduced);
  }, [reduced]);

  const update = useCallback((value: boolean) => {
    setReduced(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  return [reduced, update];
}
