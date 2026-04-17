<script lang="ts">
  import { login } from '$lib/api';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';
  import { toasts } from '$lib/toasts';
  import { language, t } from '$lib/i18n';

  const email = writable('');
  const password = writable('');
  const loading = writable(false);

  function mapApiMessage(msg: string): string {
    const normalized = msg.trim().toLowerCase();

    if (normalized === 'email is required') {
      return t('login.error.emailRequired', $language);
    }

    if (normalized === 'password is required') {
      return t('login.error.passwordRequired', $language);
    }

    if (normalized.includes('неверный логин или пароль') || normalized.includes('invalid credentials')) {
      return t('login.error.invalidCredentials', $language);
    }

    return msg;
  }

  function normalizeErrorMessage(err: unknown): string {
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
              return t('login.error.invalidCredentials', $language);
            }

            if (parsed?.statusCode >= 500) {
              return t('login.error.serverUnavailable', $language);
            }

            if (parsed?.message) return mapApiMessage(String(parsed.message));
          } catch {
            // fallback to plain text
          }
        }

        if (payload.startsWith('401')) {
          return t('login.error.invalidCredentials', $language);
        }

        if (payload.startsWith('5')) {
          return t('login.error.serverUnavailable', $language);
        }
      }

      return mapApiMessage(raw);
    }

    return t('login.error.default', $language);
  }

  async function submit(e: Event) {
    e.preventDefault();
    loading.set(true);
    try {
      let em: string, pw: string;
      email.subscribe((v) => (em = v))();
      password.subscribe((v) => (pw = v))();
      await login(em!, pw!);
      toasts.success(t('login.success', $language));
      // After login go to registry
      goto('/imdg');
    } catch (err) {
      toasts.error(normalizeErrorMessage(err));
    } finally {
      loading.set(false);
    }
  }
</script>

<section class="app-surface mx-auto max-w-md rounded-2xl p-6 sm:p-7">
  <h1 class="mb-5 text-3xl font-semibold">{t('login.title', $language)}</h1>
  <form on:submit|preventDefault={submit} class="space-y-4">
    <div>
      <label for="email" class="app-text-muted block text-sm font-medium">{t('login.email', $language)}</label>
      <input id="email" bind:value={$email} class="app-input mt-1" autocomplete="username" />
    </div>
    <div>
      <label for="password" class="app-text-muted block text-sm font-medium">{t('login.password', $language)}</label>
      <input id="password" type="password" bind:value={$password} class="app-input mt-1" autocomplete="current-password" />
    </div>
    <div class="flex justify-end">
      <button class="app-btn app-btn-primary px-5 py-2" disabled={$loading}>{t('login.submit', $language)}</button>
    </div>
  </form>
</section>
