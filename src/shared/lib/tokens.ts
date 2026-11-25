// Lưu cặp JWT backend cấp (access token 15 phút + refresh token).
// Hỗ trợ nhiều tab độc lập vai trò:
// - Mỗi tab giữ con trỏ phiên riêng trong sessionStorage (`equiflow.tab_sid`).
// - Khi "Remember me" bật, các phiên lưu theo từng `sid` trong localStorage (`equiflow.sessions`) để mở tab mới vẫn kế thừa được phiên hiện tại, nhưng đăng nhập/đổi vai trò ở tab khác không ghi đè tab đang mở.
// - Khi "Remember me" tắt, token nằm riêng trong sessionStorage của tab đó.

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SaveTokensOptions {
  /** Bật khi đăng nhập mới hoặc đổi vai trò để tạo phiên riêng cho tab hiện tại. */
  newSession?: boolean;
}

interface StoredSession extends TokenPair {
  updatedAt: number;
}

const KEY = "equiflow.tokens";
const SESSIONS_KEY = "equiflow.sessions";
const ACTIVE_SID_KEY = "equiflow.active_sid";
const TAB_SID_KEY = "equiflow.tab_sid";
const MAX_SESSIONS = 24;

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Bỏ qua khi storage bị chặn.
  }
}

function safeRemove(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Bỏ qua khi storage bị chặn.
  }
}

function readToken(storage: Storage | undefined): TokenPair | null {
  const raw = safeGet(storage, KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TokenPair> | null;
    if (typeof parsed?.accessToken === "string" && typeof parsed?.refreshToken === "string") {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
    return null;
  } catch {
    return null;
  }
}

function readSessions(): Record<string, StoredSession> {
  const raw = safeGet(globalThis.localStorage, SESSIONS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<StoredSession>> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, StoredSession> = {};
    for (const [sid, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.accessToken === "string" && typeof entry.refreshToken === "string") {
        result[sid] = {
          accessToken: entry.accessToken,
          refreshToken: entry.refreshToken,
          updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeSessions(sessions: Record<string, StoredSession>, preserveSid?: string): void {
  const entries = Object.entries(sessions);
  if (entries.length > MAX_SESSIONS) {
    entries.sort((a, b) => {
      if (a[0] === preserveSid) return -1;
      if (b[0] === preserveSid) return 1;
      return b[1].updatedAt - a[1].updatedAt;
    });
    const trimmed = Object.fromEntries(entries.slice(0, MAX_SESSIONS));
    safeSet(globalThis.localStorage, SESSIONS_KEY, JSON.stringify(trimmed));
    return;
  }
  if (entries.length === 0) {
    safeRemove(globalThis.localStorage, SESSIONS_KEY);
    return;
  }
  safeSet(globalThis.localStorage, SESSIONS_KEY, JSON.stringify(sessions));
}

function generateSid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `sid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getCurrentSessionId(): string | null {
  return safeGet(globalThis.sessionStorage, TAB_SID_KEY);
}

export function getTokens(): TokenPair | null {
  const sessionToken = readToken(globalThis.sessionStorage);
  if (sessionToken) return sessionToken;

  const sessions = readSessions();
  const tabSid = getCurrentSessionId();
  if (tabSid) {
    const bound = sessions[tabSid];
    if (bound) {
      return { accessToken: bound.accessToken, refreshToken: bound.refreshToken };
    }
    // Hỗ trợ test/kịch bản xóa localStorage rồi ghi trực tiếp `equiflow.tokens`.
    const hasSessionMap = safeGet(globalThis.localStorage, SESSIONS_KEY) !== null;
    const hasActiveSid = safeGet(globalThis.localStorage, ACTIVE_SID_KEY) !== null;
    if (hasSessionMap || hasActiveSid) {
      return null;
    }
  }

  const activeSid = safeGet(globalThis.localStorage, ACTIVE_SID_KEY);
  if (activeSid && sessions[activeSid]) {
    safeSet(globalThis.sessionStorage, TAB_SID_KEY, activeSid);
    return {
      accessToken: sessions[activeSid].accessToken,
      refreshToken: sessions[activeSid].refreshToken,
    };
  }

  const legacy = readToken(globalThis.localStorage);
  if (legacy) {
    const sid = "default";
    const next = { ...sessions, [sid]: { ...legacy, updatedAt: Date.now() } };
    writeSessions(next, sid);
    safeSet(globalThis.localStorage, ACTIVE_SID_KEY, sid);
    safeSet(globalThis.sessionStorage, TAB_SID_KEY, sid);
    return legacy;
  }

  return null;
}

// `remember` bỏ trống = giữ nơi lưu hiện tại (dùng khi làm mới token).
export function saveTokens(tokens: TokenPair, remember?: boolean, options?: SaveTokensOptions): void {
  if (options?.newSession) {
    const persist = remember ?? true;
    if (!persist) {
      safeRemove(globalThis.sessionStorage, TAB_SID_KEY);
      safeSet(globalThis.sessionStorage, KEY, JSON.stringify(tokens));
      return;
    }
    safeRemove(globalThis.sessionStorage, KEY);
    const sid = generateSid();
    safeSet(globalThis.sessionStorage, TAB_SID_KEY, sid);
    const sessions = readSessions();
    sessions[sid] = { ...tokens, updatedAt: Date.now() };
    writeSessions(sessions, sid);
    safeSet(globalThis.localStorage, ACTIVE_SID_KEY, sid);
    safeSet(globalThis.localStorage, KEY, JSON.stringify(tokens));
    return;
  }

  const inSession = readToken(globalThis.sessionStorage) !== null;
  const persist = remember ?? !inSession;
  if (!persist) {
    safeRemove(globalThis.sessionStorage, TAB_SID_KEY);
    safeSet(globalThis.sessionStorage, KEY, JSON.stringify(tokens));
    return;
  }

  safeRemove(globalThis.sessionStorage, KEY);
  const currentActive = safeGet(globalThis.localStorage, ACTIVE_SID_KEY);
  const sid = getCurrentSessionId() ?? currentActive ?? generateSid();
  safeSet(globalThis.sessionStorage, TAB_SID_KEY, sid);
  const sessions = readSessions();
  sessions[sid] = { ...tokens, updatedAt: Date.now() };
  writeSessions(sessions, sid);
  if (!currentActive || currentActive === sid) {
    safeSet(globalThis.localStorage, ACTIVE_SID_KEY, sid);
    safeSet(globalThis.localStorage, KEY, JSON.stringify(tokens));
  }
}

export function clearTokens(): void {
  const sessionToken = readToken(globalThis.sessionStorage);
  safeRemove(globalThis.sessionStorage, KEY);

  const tabSid = getCurrentSessionId();
  safeRemove(globalThis.sessionStorage, TAB_SID_KEY);

  if (tabSid) {
    const sessions = readSessions();
    if (sessions[tabSid]) {
      delete sessions[tabSid];
      writeSessions(sessions);
    }
    if (safeGet(globalThis.localStorage, ACTIVE_SID_KEY) === tabSid) {
      safeRemove(globalThis.localStorage, ACTIVE_SID_KEY);
      safeRemove(globalThis.localStorage, KEY);
    }
    return;
  }

  if (!sessionToken) {
    safeRemove(globalThis.localStorage, KEY);
  }
}
