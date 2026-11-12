/**
 * Single source of truth for the backend JWT.
 *
 * - Token lives in memory, mirrored to localStorage so it survives a reload
 *   (but not a new tab / browser restart). Never put it in localStorage, never log it.
 * - `exp` is decoded on store; the session ends proactively when it passes.
 * - `end()` is idempotent: however many requests hit 401 at once, listeners
 *   (the login screen) are notified once, and in-flight requests are aborted.
 */

const STORAGE_KEY = "jwt";
/** End the session slightly early so requests don't race the real expiry. */
const EXPIRY_SKEW_MS = 30_000;
/** setTimeout overflows above this (~24.8 days). */
const MAX_TIMEOUT_MS = 2_147_483_647;

export type EndReason = "expired" | "logout";

type Listener = (token: string | null, reason: EndReason | null) => void;

function decodeExpMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const { exp } = JSON.parse(atob(b64));
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null; // Unreadable token: let the backend decide (it will 401).
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(token: string | null) {
  try {
    if (token === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage unavailable (private mode etc.) — in-memory token still works.
  }
}

class AuthSession {
  private token: string | null = null;
  private expMs: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller = new AbortController();
  private listeners = new Set<Listener>();
  private lastReason: EndReason | null = null;

  constructor() {
    const stored = readStored();
    if (stored) this.start(stored);
  }

  getToken(): string | null {
    if (this.token !== null && this.isExpired()) this.end("expired");
    return this.token;
  }

  /** Why the last session ended (null if none ended in this page load). */
  getEndReason(): EndReason | null {
    return this.lastReason;
  }

  /** Aborted when the current session ends. Pass to every authenticated fetch. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  isExpired(): boolean {
    return this.expMs !== null && Date.now() >= this.expMs - EXPIRY_SKEW_MS;
  }

  start(token: string) {
    this.clearTimer();
    this.token = token;
    this.expMs = decodeExpMs(token);
    this.lastReason = null;
    this.controller = new AbortController();

    if (this.isExpired()) {
      this.end("expired");
      return;
    }
    writeStored(token);
    this.scheduleExpiry();
    this.emit();
  }

  /** Idempotent: a no-op if there is no active session. */
  end(reason: EndReason) {
    if (this.token === null) return;
    this.clearTimer();
    this.token = null;
    this.expMs = null;
    this.lastReason = reason;
    writeStored(null);
    this.controller.abort();
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private scheduleExpiry() {
    if (this.expMs === null) return;
    const delay = Math.min(this.expMs - EXPIRY_SKEW_MS - Date.now(), MAX_TIMEOUT_MS);
    // If the timer fires late (sleeping tab), getToken() catches it before the next request.
    this.timer = setTimeout(() => {
      if (this.isExpired()) this.end("expired");
      else this.scheduleExpiry();
    }, Math.max(delay, 0));
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit() {
    for (const l of this.listeners) l(this.token, this.lastReason);
  }
}

export const authSession = new AuthSession();
