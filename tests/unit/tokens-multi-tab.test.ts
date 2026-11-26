import test from "node:test";
import assert from "node:assert/strict";
import {
  clearTokens,
  getCurrentSessionId,
  getTokens,
  saveTokens,
} from "../../src/shared/lib/tokens.ts";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function installBrowserStorages() {
  const local = createMemoryStorage();
  const tabs: Storage[] = [];
  const switchTab = (tabIndex: number) => {
    while (tabs.length <= tabIndex) tabs.push(createMemoryStorage());
    Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true });
    Object.defineProperty(globalThis, "sessionStorage", { value: tabs[tabIndex], configurable: true });
  };
  switchTab(0);
  return { local, switchTab };
}

test("multi-tab role switch keeps existing tab on its own session and tokens", () => {
  const { local, switchTab } = installBrowserStorages();

  // Tab 0 logs in as Club Manager (remember=true)
  switchTab(0);
  saveTokens({ accessToken: "at-mgr-1", refreshToken: "rt-mgr-1" }, true, { newSession: true });
  const mgrSid = getCurrentSessionId();
  assert.ok(mgrSid);
  assert.deepEqual(getTokens(), { accessToken: "at-mgr-1", refreshToken: "rt-mgr-1" });
  assert.equal(
    local.getItem("equiflow.tokens"),
    JSON.stringify({ accessToken: "at-mgr-1", refreshToken: "rt-mgr-1" }),
  );

  // Tab 1 opens fresh -> inherits active session (Club Manager)
  switchTab(1);
  assert.deepEqual(getTokens(), { accessToken: "at-mgr-1", refreshToken: "rt-mgr-1" });
  assert.equal(getCurrentSessionId(), mgrSid);

  // Tab 1 switches role to Head Trainer (remember=true, newSession=true)
  saveTokens({ accessToken: "at-trn-1", refreshToken: "rt-trn-1" }, true, { newSession: true });
  const trnSid = getCurrentSessionId();
  assert.ok(trnSid);
  assert.notEqual(trnSid, mgrSid);
  assert.deepEqual(getTokens(), { accessToken: "at-trn-1", refreshToken: "rt-trn-1" });

  // Tab 0 MUST still keep Club Manager tokens!
  switchTab(0);
  assert.equal(getCurrentSessionId(), mgrSid);
  assert.deepEqual(getTokens(), { accessToken: "at-mgr-1", refreshToken: "rt-mgr-1" });

  // Tab 0 refreshes its own tokens -> updates mgrSid without disturbing Tab 1
  saveTokens({ accessToken: "at-mgr-2", refreshToken: "rt-mgr-2" });
  assert.deepEqual(getTokens(), { accessToken: "at-mgr-2", refreshToken: "rt-mgr-2" });

  switchTab(1);
  assert.deepEqual(getTokens(), { accessToken: "at-trn-1", refreshToken: "rt-trn-1" });

  // Tab 1 logs out -> only clears Tab 1's session, Tab 0 stays authenticated
  clearTokens();
  assert.equal(getTokens(), null);
  switchTab(0);
  assert.deepEqual(getTokens(), { accessToken: "at-mgr-2", refreshToken: "rt-mgr-2" });
});

test("shared session across tabs shares rotated tokens and clears cleanly on logout", () => {
  const { switchTab } = installBrowserStorages();

  switchTab(0);
  saveTokens({ accessToken: "at-1", refreshToken: "rt-1" }, true, { newSession: true });
  const sharedSid = getCurrentSessionId();

  // Tab 1 opens fresh -> shares same sid
  switchTab(1);
  assert.deepEqual(getTokens(), { accessToken: "at-1", refreshToken: "rt-1" });
  assert.equal(getCurrentSessionId(), sharedSid);

  // Tab 1 rotates refresh token -> Tab 0 immediately sees the rotated token pair
  saveTokens({ accessToken: "at-2", refreshToken: "rt-2" });
  switchTab(0);
  assert.deepEqual(getTokens(), { accessToken: "at-2", refreshToken: "rt-2" });

  // Tab 1 explicitly signs out of the shared sid -> Tab 0 sees null
  switchTab(1);
  clearTokens();
  switchTab(0);
  assert.equal(getTokens(), null);
});

test("supports legacy direct localStorage equiflow.tokens injection and non-remembered tabs", () => {
  const { local, switchTab } = installBrowserStorages();

  // Legacy injection like Playwright tests
  switchTab(0);
  local.setItem("equiflow.tokens", JSON.stringify({ accessToken: "at-e2e", refreshToken: "rt-e2e" }));
  assert.deepEqual(getTokens(), { accessToken: "at-e2e", refreshToken: "rt-e2e" });

  // Non-remembered login in Tab 1 does not wipe Tab 0's localStorage session
  switchTab(1);
  saveTokens({ accessToken: "at-sess", refreshToken: "rt-sess" }, false, { newSession: true });
  assert.deepEqual(getTokens(), { accessToken: "at-sess", refreshToken: "rt-sess" });

  switchTab(0);
  assert.deepEqual(getTokens(), { accessToken: "at-e2e", refreshToken: "rt-e2e" });
});
