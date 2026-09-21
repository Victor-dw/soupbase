import "server-only";
import { AppError } from "./access";

export function lockedFetch(allowedHost: string) {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    const host = new URL(String(url)).hostname;
    if (host !== allowedHost) throw new AppError("upstream_failed", 502);
    return fetch(url, { ...init, redirect: "error" });
  };
}

export function hostOf(base: string) {
  return new URL(base.includes("://") ? base : `https://${base}`).hostname;
}