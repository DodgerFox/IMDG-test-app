<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { loadTokensFromStorage } from '$lib/stores';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { language, initLanguage, setLanguage, t } from '$lib/i18n';
  import { initTheme, setTheme, theme } from '$lib/theme';

  onMount(() => {
    loadTokensFromStorage();
    initLanguage();
    initTheme();
  });
</script>

<nav class="border-b" style="border-color: var(--border); background: var(--bg-elevated)">
  <div class="mx-auto max-w-7xl px-6 lg:px-8">
    <div class="flex min-h-20 flex-wrap items-center justify-between gap-3 py-3 sm:flex-nowrap sm:py-0">
      <div class="text-lg font-semibold leading-tight">{t('app.title', $language)}</div>
      <div class="flex items-center gap-2 sm:gap-3">
        <div class="inline-flex overflow-hidden rounded-lg border" style="border-color: var(--border)">
          <button
            type="button"
            class={`px-3 py-1.5 text-xs ${$theme === 'light' ? 'app-btn-primary' : 'app-btn-ghost'}`}
            on:click={() => setTheme('light')}
          >
            {t('app.theme.light', $language)}
          </button>
          <button
            type="button"
            class={`px-3 py-1.5 text-xs ${$theme === 'dark' ? 'app-btn-primary' : 'app-btn-ghost'}`}
            on:click={() => setTheme('dark')}
          >
            {t('app.theme.dark', $language)}
          </button>
        </div>

        <div class="inline-flex overflow-hidden rounded-lg border" style="border-color: var(--border)">
          <button
            type="button"
            class={`px-3 py-1.5 text-xs ${$language === 'ru' ? 'app-btn-primary' : 'app-btn-ghost'}`}
            on:click={() => setLanguage('ru')}
          >
            {t('lang.ru', $language)}
          </button>
          <button
            type="button"
            class={`px-3 py-1.5 text-xs ${$language === 'en' ? 'app-btn-primary' : 'app-btn-ghost'}`}
            on:click={() => setLanguage('en')}
          >
            {t('lang.en', $language)}
          </button>
        </div>
      </div>
    </div>
  </div>
</nav>

<main class="mx-auto max-w-7xl p-3 sm:p-6">
  <slot />
</main>

<ToastContainer />
