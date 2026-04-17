import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  timeoutMs: number;
};

const DEFAULT_TIMEOUT_MS = 4000;

function createToastStore() {
  const { subscribe, update } = writable<ToastItem[]>([]);

  const remove = (id: number) => {
    update((list) => list.filter((t) => t.id !== id));
  };

  const push = (type: ToastType, message: string, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const item: ToastItem = { id, type, message, timeoutMs };

    update((list) => [...list, item]);

    if (timeoutMs > 0) {
      setTimeout(() => remove(id), timeoutMs);
    }

    return id;
  };

  return {
    subscribe,
    push,
    remove,
    success: (message: string, timeoutMs?: number) => push('success', message, timeoutMs),
    error: (message: string, timeoutMs?: number) => push('error', message, timeoutMs),
    info: (message: string, timeoutMs?: number) => push('info', message, timeoutMs)
  };
}

export const toasts = createToastStore();
