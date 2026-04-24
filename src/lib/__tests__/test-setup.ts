// Minimal polyfills for tests running in Node environment
// Provide a simple localStorage implementation used by the stores tests.

class SimpleStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key) ?? null : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

if (typeof (globalThis as unknown as { localStorage?: unknown }).localStorage === 'undefined') {
  (globalThis as any).localStorage = new SimpleStorage();
}

// Provide a minimal fetch implementation if not present (tests mock global.fetch where needed)
if (typeof (globalThis as unknown as { fetch?: unknown }).fetch === 'undefined') {
  (globalThis as any).fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
}
