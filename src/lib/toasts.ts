import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  timeoutMs: number;
};

const DEFAULT_TIMEOUT_MS = 4000;
let idCounter = 1;

function createToastStore() {
  const { subscribe, update } = writable<ToastItem[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  const remove = (id: number) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    update((list) => list.filter((t) => t.id !== id));
  };

  const push = (type: ToastType, message: string, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const id = idCounter++;
    const item: ToastItem = { id, type, message, timeoutMs };

    update((list) => [...list, item]);

    if (timeoutMs > 0) {
      const timer = setTimeout(() => remove(id), timeoutMs);
      timers.set(id, timer);
    }

    return id;
  };

  return {
    subscribe,
    push,
    remove,
    success: (message: string, timeoutMs?: number) => push('success', message, timeoutMs),
    error: (message: string, timeoutMs?: number) => push('error', message, timeoutMs),
    info: (message: string, timeoutMs?: number) => push('info', message, timeoutMs),
  };
}

export const toasts = createToastStore();
