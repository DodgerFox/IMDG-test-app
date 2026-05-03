<script lang="ts">
  import { login } from '$lib/api';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';
  import { toasts } from '$lib/toasts';

  const email = writable('');
  const password = writable('');
  const loading = writable(false);

  const mapApiMessage = (msg: string): string => {
    const normalized = msg.trim().toLowerCase();

    if (normalized === 'email is required') {
      return 'Email обязателен';
    }

    if (normalized === 'password is required') {
      return 'Пароль обязателен';
    }

    if (normalized.includes('неверный логин или пароль') || normalized.includes('invalid credentials')) {
      return 'Неверный логин или пароль';
    }

    return msg;
  };

  const normalizeErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      const raw = err.message;
      const marker = 'login failed:';
      const idx = raw.indexOf(marker);

      if (idx >= 0) {
        const payload = raw.slice(idx + marker.length).trim();
        const firstBrace = payload.indexOf('{');

        if (firstBrace >= 0) {
          const maybeJson = payload.slice(firstBrace);
          try {
            const parsed = JSON.parse(maybeJson);
            if (parsed?.statusCode === 401) {
              return 'Неверный логин или пароль';
            }

            if (parsed?.statusCode >= 500) {
              return 'Сервер временно недоступен';
            }

            if (parsed?.message) return mapApiMessage(String(parsed.message));
          } catch {
            // fallback to plain text
          }
        }

        if (payload.startsWith('401')) {
          return 'Неверный логин или пароль';
        }

        if (payload.startsWith('5')) {
          return 'Сервер временно недоступен';
        }
      }

      return mapApiMessage(raw);
    }

    return 'Ошибка входа';
  }

  import { get } from 'svelte/store';

  const submit = async (e: Event) => {
    e.preventDefault();
    loading.set(true);
    try {
      const em = get(email);
      const pw = get(password);
      await login(em, pw);
      toasts.success('Вход выполнен');
      // After login go to registry
      goto('/imdg');
    } catch (err) {
      toasts.error(normalizeErrorMessage(err));
    } finally {
      loading.set(false);
    }
  };
</script>

<section class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
  <h1 class="mb-5 text-3xl font-semibold">Вход</h1>
  <form on:submit|preventDefault={submit} class="space-y-4">
    <div>
      <label for="email" class="block text-sm font-medium text-slate-600">Email</label>
      <input
        id="email"
        bind:value={$email}
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        autocomplete="username"
      />
    </div>
    <div>
      <label for="password" class="block text-sm font-medium text-slate-600">Пароль</label>
      <input
        id="password"
        type="password"
        bind:value={$password}
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        autocomplete="current-password"
      />
    </div>
    <div class="flex justify-end">
      <button
        class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={$loading}
      >
        Войти
      </button>
    </div>
  </form>
</section>
