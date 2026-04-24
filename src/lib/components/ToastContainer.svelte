<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { toasts } from '$lib/toasts';
  import { language, t } from '$lib/i18n';

  const colorByType = (type: 'success' | 'error' | 'info'): string => {
    if (type === 'success') return 'border-green-200 bg-green-50 text-green-900';
    if (type === 'error') return 'border-red-200 bg-red-50 text-red-900';
    return 'border-blue-200 bg-blue-50 text-blue-900';
  };

  const titleByType = (type: 'success' | 'error' | 'info'): string => {
    if (type === 'success') return t('toast.success.title', $language);
    if (type === 'error') return t('toast.error.title', $language);
    return t('toast.info.title', $language);
  };

  const iconByType = (type: 'success' | 'error' | 'info'): string => {
    if (type === 'success') return '✓';
    if (type === 'error') return '⚠';
    return 'ℹ';
  };
</script>

<div class="fixed inset-x-0 bottom-2 z-50 pointer-events-none sm:bottom-4">
  <div class="mx-auto flex w-full max-w-2xl min-w-[320px] flex-col gap-2 px-2 sm:px-4">
    {#each $toasts as toast (toast.id)}
      <div
        in:fly={{ y: 22, opacity: 0, duration: 220 }}
        out:fade={{ duration: 160 }}
        class={`pointer-events-auto rounded-lg border px-3 py-3 shadow-sm ${colorByType(toast.type)} sm:px-4`}
        role="status"
        aria-live="polite"
      >
        <div class="flex items-start justify-between gap-2 sm:gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold leading-5">
              <span class="mr-1">{iconByType(toast.type)}</span>{titleByType(toast.type)}
            </p>
            <p class="mt-0.5 break-words text-sm leading-5">{toast.message}</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded px-2 py-1 text-xs opacity-80 hover:opacity-100"
            on:click={() => toasts.remove(toast.id)}
          >
            {t('toasts.close', $language)}
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>
