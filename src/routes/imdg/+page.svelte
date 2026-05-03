<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getIMDGList } from '$lib/api';
  import { toasts } from '$lib/toasts';

  type Item = Record<string, unknown>;

  let items: Item[] = [];
  let serverItems: Item[] = [];
  let columns: string[] = [];
  let filters: Record<string, string> = {};
  let appliedServerFilters: Record<string, string> = {};
  let total = 0;
  let page = 1;
  let pageSize = 10;
  let loading = false;
  let loadingProgress = 0;
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let requestId = 0;
  let focusedFilterColumn: string | null = null;

  const excludedFilterColumns = new Set<string>([
    'createdAt',
    'updatedAt',
    ...Array.from({ length: 17 }, (_, idx) => `col${idx + 3}`),
  ]);
  let localOnlyColumns = new Set<string>(['uuid']);
  let localFallbackNotified = new Set<string>();

  $: maxPage = Math.max(1, Math.ceil(total / pageSize));
  $: activeFilters = Object.fromEntries(
    Object.entries(filters).filter(
      ([key, value]) => !excludedFilterColumns.has(key) && value.trim() !== ''
    )
  );
  $: localFilters = Object.fromEntries(
    Object.entries(activeFilters).filter(([key]) => localOnlyColumns.has(key))
  );
  $: serverFilters = Object.fromEntries(
    Object.entries(activeFilters).filter(([key]) => !localOnlyColumns.has(key))
  );
  $: items = serverItems.filter((row) => {
    for (const [key, value] of Object.entries(localFilters)) {
      const cell = String(row[key] ?? '').toLowerCase();
      if (!cell.includes(value.toLowerCase())) return false;
    }
    return true;
  });

  const normalizeImdgError = (err: unknown): string => {
    if (err instanceof Error) {
      const raw = err.message.toLowerCase();
      if (raw.includes('401') || raw.includes('unauthorized')) return 'Авторизация истекла';
      if (raw.includes('500') || raw.includes('502') || raw.includes('503') || raw.includes('504')) {
        return 'Сервер временно недоступен';
      }
      if (raw.includes('failed to fetch') || raw.includes('networkerror')) return 'Ошибка сети';
    }
    return 'Ошибка загрузки данных';
  };

  const isUnauthorizedError = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    const raw = err.message.toLowerCase();
    return raw.includes('401') || raw.includes('unauthorized');
  };

  const syncFiltersWithColumns = (nextColumns: string[]) => {
    const next: Record<string, string> = {};
    for (const col of nextColumns) next[col] = filters[col] ?? '';
    filters = next;
  };

  const parseNotFilterableField = (err: unknown): string | null => {
    if (!(err instanceof Error)) return null;
    const m = err.message.match(/The field '([^']+)' is not filtrable/i);
    return m?.[1] ?? null;
  };

  const extractApiMessage = (err: unknown): string | null => {
    if (!(err instanceof Error)) return null;
    const msg = err.message;
    const jsonStart = msg.indexOf('{');
    if (jsonStart < 0) return null;
    try {
      const payload = JSON.parse(msg.slice(jsonStart));
      if (payload && typeof payload.message === 'string') return payload.message;
    } catch {
      // ignore parse errors
    }
    return null;
  };

  const load = async (filtersForServer: Record<string, string> = serverFilters) => {
    const currentRequest = ++requestId;
    loading = true;
    loadingProgress = 12;
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      loadingProgress = Math.min(90, loadingProgress + Math.max(1, Math.round((90 - loadingProgress) / 8)));
    }, 120);
    try {
      const data = await getIMDGList({ page, pageSize, filters: filtersForServer });
      if (currentRequest !== requestId) return;
      serverItems = data.items ?? [];
      total = data.total ?? 0;
      columns = serverItems[0] ? Object.keys(serverItems[0]) : columns;
      syncFiltersWithColumns(columns);
      appliedServerFilters = { ...filtersForServer };
      if (page > maxPage) page = maxPage;
    } catch (e) {
      if (currentRequest !== requestId) return;
      if (isUnauthorizedError(e)) {
        await goto('/');
        return;
      }

      const field = parseNotFilterableField(e);
      if (field) {
        const apiMessage = extractApiMessage(e) ?? `The field '${field}' is not filtrable`;
        toasts.error(apiMessage);
        localOnlyColumns.add(field);
        if (!localFallbackNotified.has(field)) {
          localFallbackNotified.add(field);
          toasts.info(`Поле "${field}" фильтруется локально по загруженным данным`, 5000);
        }
        const retriedFilters = Object.fromEntries(
          Object.entries(filtersForServer).filter(([key]) => key !== field)
        );
        if (JSON.stringify(retriedFilters) !== JSON.stringify(filtersForServer)) {
          await load(retriedFilters);
          return;
        }
      }

      toasts.error(normalizeImdgError(e));
    } finally {
      if (currentRequest === requestId) {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
        loadingProgress = 100;
        setTimeout(() => {
          if (currentRequest === requestId) {
            loading = false;
            loadingProgress = 0;
          }
        }, 120);
      }
    }
  };

  const onFilterInput = (key: string, value: string) => {
    if (excludedFilterColumns.has(key)) return;
    filters = { ...filters, [key]: value };
  };

  const applyFilters = async () => {
    const serverFiltersChanged = JSON.stringify(serverFilters) !== JSON.stringify(appliedServerFilters);
    page = 1;
    if (serverFiltersChanged) {
      await load(serverFilters);
    }
  };

  const onFilterKeyDown = async (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    await applyFilters();
  };

  const filterHint = (col: string): string => {
    if (col === 'id' || col === 'unid') return 'Число. Enter для поиска';
    if (col === 'uuid') return 'Текст UUID. Enter для поиска';
    return 'Текст. Enter для поиска';
  };

  const onPageSizeChange = async () => {
    page = 1;
    await load();
  };

  const clearAllFilters = async () => {
    const next: Record<string, string> = {};
    for (const col of columns) next[col] = '';
    filters = next;
    page = 1;
    await load({});
  };

  const refreshData = async () => {
    await load(serverFilters);
  };

  const goPrev = async () => {
    page = Math.max(1, page - 1);
    await load();
  };

  const goNext = async () => {
    page = Math.min(maxPage, page + 1);
    await load();
  };

  onMount(async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      await goto('/');
      return;
    }
    await load();
  });
</script>

<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold">Реестр IMDG</h2>
      <p class="text-sm text-slate-500">Всего: {total}</p>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        on:click={clearAllFilters}
      >
        Очистить фильтры
      </button>
      <button
        type="button"
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        on:click={refreshData}
      >
        Обновить
      </button>
      <label for="pageSize" class="text-sm text-slate-500">Размер страницы</label>
      <select
        id="pageSize"
        bind:value={pageSize}
        class="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        on:change={onPageSizeChange}
      >
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="25">25</option>
        <option value="50">50</option>
      </select>
    </div>
  </div>

  <div class="relative overflow-auto rounded-lg border border-slate-200">
    {#if loading}
      <div class="absolute left-0 right-0 top-0 z-30 h-1 bg-slate-100">
        <div
          class="h-full bg-blue-600 transition-[width] duration-150 ease-out"
          style={`width:${loadingProgress}%`}
        ></div>
      </div>
    {/if}
    {#if loading}
      <div class="pointer-events-none absolute inset-0 z-20 bg-white/50"></div>
    {/if}
    <table class="min-w-[980px] table-fixed border-separate border-spacing-0">
      <thead>
        <tr class="sticky top-0 z-10 bg-slate-50">
          {#each columns as col}
            <th class="min-w-[120px] max-w-[500px] border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600 last:border-r-0">
              {col}
            </th>
          {/each}
        </tr>
        <tr class="sticky top-9 z-[9] bg-slate-50">
          {#each columns as col}
            <th class="min-w-[120px] max-w-[500px] border-b border-r border-slate-200 px-3 pb-2 text-left last:border-r-0">
              <div class="relative">
                {#if excludedFilterColumns.has(col)}
                  <div class="h-[30px]"></div>
                {:else}
                  <input
                    class="min-w-[96px] w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    type="text"
                    placeholder="Фильтр"
                    title={filterHint(col)}
                    value={filters[col] ?? ''}
                    on:focus={() => (focusedFilterColumn = col)}
                    on:blur={() => {
                      if (focusedFilterColumn === col) focusedFilterColumn = null;
                    }}
                    on:input={(e) => onFilterInput(col, (e.currentTarget as HTMLInputElement).value)}
                    on:keydown={onFilterKeyDown}
                  />
                  {#if focusedFilterColumn === col && (filters[col] ?? '').trim() !== ''}
                    <div class="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-30 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                      ⏎ Enter
                    </div>
                  {/if}
                {/if}
              </div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if items.length === 0}
          <tr>
            <td class="px-3 py-4 text-sm text-slate-500" colspan={Math.max(columns.length, 1)}>
              {loading ? 'Загрузка...' : 'Нет данных'}
            </td>
          </tr>
        {:else}
          {#each items as item}
            <tr class="hover:bg-slate-50">
              {#each columns as col}
                <td class="max-w-[500px] truncate border-b border-slate-100 px-3 py-2 text-sm">{String(item[col] ?? '—')}</td>
              {/each}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <div class="mt-3 flex items-center justify-between gap-3">
    <div class="text-sm text-slate-500">Страница: {page} / {maxPage}</div>
    <div class="flex items-center gap-2">
      <button
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        on:click={goPrev}
        disabled={page <= 1}
      >
        Назад
      </button>
      <button
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        on:click={goNext}
        disabled={page >= maxPage}
      >
        Вперёд
      </button>
    </div>
  </div>
</section>
