"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** Keep off-canvas navigation out of the tab order and restore focus on close. */
export function useMobileNavigation(open: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  const navigationRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) setOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [setOpen]);

  useEffect(() => {
    if (!mobile || !open) return;
    const navigation = navigationRef.current;
    const trigger = triggerRef.current;
    if (!navigation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(navigation.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"]',
    )).filter(element => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [mobile, open, setOpen]);

  return { navigationRef, triggerRef, mobile };
}
