"use client";

import { useEffect, useRef } from "react";

/*
  The phone's "back" closes the window that is open (a photo, a person's card, the search, the
  menu) instead of leaving the page. Opening a window adds a step to the browser's history; "back"
  takes that step and the window closes. Closing it any other way (the X, Escape, a tap outside)
  removes the step again, so the history stays as it was. Windows open on top of each other close
  one at a time, the top one first.
*/

type Entry = { close: () => void; byBack: boolean };
const stack: Entry[] = [];
/** steps this code takes back itself, which must not close anything */
let skip = 0;
let listening = false;
/** a step just given up, taken back a moment later unless a window opens again at once and keeps it */
let pending: { key: string; timer: ReturnType<typeof setTimeout> } | null = null;

function onPop() {
  if (skip > 0) {
    skip--;
    return;
  }
  const top = stack.pop();
  if (!top) return;
  top.byBack = true;
  top.close();
}

/**
 * While `open`, "back" calls `close`. Returns `release`: call it before closing for a link that
 * goes to another page, so the window's step is left behind instead of being taken back (taking it
 * back would undo the link).
 */
export function useBackClose(open: boolean, close: () => void) {
  const fn = useRef(close);
  fn.current = close;
  const current = useRef<Entry | null>(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    if (!listening) {
      window.addEventListener("popstate", onPop);
      listening = true;
    }
    const entry: Entry = { close: () => fn.current(), byBack: false };
    current.current = entry;
    stack.push(entry);
    let key: string;
    if (pending && window.history.state?.rozaWindow === pending.key) {
      // a window closed a moment ago and another opens now: it keeps that step rather than take it back and add one
      clearTimeout(pending.timer);
      key = pending.key;
      pending = null;
    } else {
      key = Math.random().toString(36).slice(2);
      // keep the router's own notes in the step, so going back to it is an ordinary step on the same page
      window.history.pushState({ ...(window.history.state ?? {}), rozaWindow: key }, "", window.location.href);
    }
    return () => {
      current.current = null;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (entry.byBack) return;
      if (pending) clearTimeout(pending.timer);
      pending = {
        key,
        timer: setTimeout(() => {
          pending = null;
          if (window.history.state?.rozaWindow !== key) return;
          skip++;
          window.history.back();
        }, 0),
      };
    };
  }, [open]);

  return () => {
    const e = current.current;
    if (!e) return;
    // leave the step where it is: it points at this same page, so "back" from the next page lands here
    e.byBack = true;
    const i = stack.indexOf(e);
    if (i >= 0) stack.splice(i, 1);
  };
}
