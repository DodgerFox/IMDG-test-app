<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { loadTokensFromStorage } from '$lib/stores';
  import ToastContainer from '$lib/components/ToastContainer.svelte';

  onMount(() => {
    loadTokensFromStorage();
  });
</script>

<nav class="border-b border-slate-200 bg-white">
  <div class="mx-auto max-w-7xl px-6 lg:px-8">
    <div class="flex min-h-20 flex-wrap items-center justify-between gap-3 py-3 sm:flex-nowrap sm:py-0">
      <div class="text-lg font-semibold leading-tight">IMDG Registry</div>
    </div>
  </div>
</nav>

<main class="mx-auto max-w-7xl p-3 sm:p-6">
  <slot />
</main>

<ToastContainer />
