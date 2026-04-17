<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import { getIMDGList } from '$lib/api';
  import { language, t } from '$lib/i18n';
  import { toasts } from '$lib/toasts';

  type Item = Record<string, unknown>;

  let items: Item[] = [];
  let total = 0;
  let page = 1;
  let pageSize = 10;
  let loading = false;
  let columns: string[] = [];
  let columnFilters: Record<string, string> = {};
  let columnWidths: Record<string, number> = {};
  let activeFilterColumn: string | null = null;
  let focusedFilterColumn: string | null = null;
  let selectedItem: Item | null = null;

  const WIDTHS_STORAGE_KEY = 'imdg-column-widths-v1';

  let resizeColumn: string | null = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  $: filteredItems = items.filter((item) => {
    return columns.every((col) => {
      const filter = (columnFilters[col] ?? '').trim().toLowerCase();
      if (!filter) return true;
      return String(item[col] ?? '').toLowerCase().includes(filter);
    });
  });

  $: maxPage = Math.max(1, Math.ceil(total / pageSize));

  $: detailsEntries = selectedItem
    ? [
        ...columns
          .filter((col) => col in selectedItem)
          .map((col) => [col, selectedItem[col]] as [string, unknown]),
        ...Object.entries(selectedItem).filter(([k]) => !columns.includes(k))
      ]
    : [];

  let lastErrorMessage = '';
  let lastErrorAt = 0;

  function getColumnWidth(col: string): number {
    if (columnWidths[col]) return columnWidths[col];
    return Math.max(90, Math.min(300, 110 + col.length * 6));
  }

  function ensureColumnWidths(cols: string[]) {
    const next = { ...columnWidths };
    let changed = false;
    for (const col of cols) {
      if (!next[col]) {
        next[col] = Math.max(90, Math.min(300, 110 + col.length * 6));
        changed = true;
      }
    }
    if (changed) {
      columnWidths = next;
      saveColumnWidths();
    }
  }

  function loadColumnWidths() {
    if (!browser) return;
    try {
      const raw = localStorage.getItem(WIDTHS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const safe: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number' && Number.isFinite(v)) {
            safe[k] = Math.max(44, Math.min(900, v));
          }
        }
        columnWidths = safe;
      }
    } catch {
      // ignore localStorage parse errors
    }
  }

  function saveColumnWidths() {
    if (!browser) return;
    localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
  }

  function beginResize(clientX: number, col: string) {
    if (!browser) return;

    resizeColumn = col;
    resizeStartX = clientX;
    resizeStartWidth = getColumnWidth(col);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('blur', stopResize);
  }

  function onResizeMove(e: MouseEvent | PointerEvent) {
    if (!resizeColumn) return;
    const delta = e.clientX - resizeStartX;
    const nextWidth = Math.max(44, resizeStartWidth + delta);
    columnWidths = { ...columnWidths, [resizeColumn]: nextWidth };
  }

  function stopResize() {
    if (!resizeColumn) return;
    resizeColumn = null;
    saveColumnWidths();

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', stopResize);
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', stopResize);
    window.removeEventListener('blur', stopResize);
  }

  function onResizeHandlePointerDown(e: PointerEvent, col: string) {
    if (!browser || resizeColumn) return;
    e.preventDefault();
    e.stopPropagation();
    beginResize(e.clientX, col);
  }

  function onResizeHandleMouseDown(e: MouseEvent, col: string) {
    if (!browser || resizeColumn) return;
    e.preventDefault();
    e.stopPropagation();
    beginResize(e.clientX, col);
  }

  function isNarrowColumn(col: string): boolean {
    return getColumnWidth(col) < 60;
  }

  function filterInputWidth(col: string): number {
    if (focusedFilterColumn === col) return 200;
    return Math.max(60, Math.min(160, getColumnWidth(col) - 14));
  }

  function filterId(col: string): string {
    return `imdg-filter-${col.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  async function openNarrowFilter(col: string) {
    if (!browser) return;
    activeFilterColumn = col;
    await tick();
    const el = document.getElementById(filterId(col)) as HTMLInputElement | null;
    el?.focus();
  }

  function normalizeImdgError(err: unknown): string {
    if (err instanceof Error) {
      const raw = err.message;
      const lower = raw.toLowerCase();

      if (lower.includes('token header is required')) {
        return t('imdg.error.tokenRequired', $language);
      }

      if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
        return t('imdg.error.network', $language);
      }

      if (lower.includes('401') || lower.includes('unauthorized')) {
        return t('imdg.error.unauthorized', $language);
      }

      if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('504')) {
        return t('imdg.error.serverUnavailable', $language);
      }
    }

    return t('imdg.error.default', $language);
  }

  function notifyImdgError(err: unknown) {
    const message = normalizeImdgError(err);
    const now = Date.now();

    if (message === lastErrorMessage && now - lastErrorAt < 2500) {
      return;
    }

    lastErrorMessage = message;
    lastErrorAt = now;
    toasts.error(message);
  }

  async function load() {
    loading = true;
    const p = getNumber(page);
    const ps = getNumber(pageSize);
    try {
      const data = await getIMDGList({ page: p, pageSize: ps });
      items = data.items || [];
      total = data.total || (data.items ? data.items.length : 0);
      if (items.length > 0) {
        const nextColumns = Object.keys(items[0]);
        columns = nextColumns;
        ensureColumnWidths(nextColumns);

        const nextFilters: Record<string, string> = {};
        for (const col of nextColumns) {
          nextFilters[col] = columnFilters[col] ?? '';
        }
        columnFilters = nextFilters;
      } else {
        columns = [];
      }
    } catch (e) {
      console.error('load error', e);
      items = [];
      total = 0;
      columns = [];
      notifyImdgError(e);
    } finally {
      loading = false;
    }
  }

  function getNumber(n: any) {
    return typeof n === 'number' ? n : Number(n || 1);
  }

  function setColumnFilter(key: string, value: string) {
    columnFilters = { ...columnFilters, [key]: value };
  }

  function goPrev() {
    page = Math.max(1, page - 1);
    load();
  }

  function goNext() {
    page = Math.min(maxPage, page + 1);
    load();
  }

  function onPageSizeChange() {
    page = 1;
    load();
  }

  function openDetails(item: Item) {
    selectedItem = item;
  }

  function closeDetails() {
    selectedItem = null;
  }

  async function copyValue(value: unknown) {
    if (!browser) return;
    const text = value === null || value === undefined ? '' : String(value);

    try {
      await navigator.clipboard.writeText(text);
      toasts.success(t('imdg.copy.success', $language));
    } catch {
      toasts.error(t('imdg.copy.error', $language));
    }
  }

  function onWindowKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selectedItem) {
      closeDetails();
    }
  }

  function isDateColumn(col: string): boolean {
    const c = col.toLowerCase();
    return c === 'createdat' || c === 'updatedat';
  }

  function formatCellValue(col: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';

    if (typeof value === 'string' && isDateColumn(col)) {
      const dt = new Date(value);
      if (!Number.isNaN(dt.getTime())) {
        const locale = $language === 'ru' ? 'ru-RU' : 'en-GB';
        return new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(dt);
      }
    }

    return String(value);
  }

  onMount(() => {
    loadColumnWidths();
    load();

    return () => {
      window.removeEventListener('mousemove', onResizeMove);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('blur', stopResize);
    };
  });

  $: if (browser && page > maxPage) {
    page = maxPage;
  }
</script>

<svelte:window on:keydown={onWindowKeyDown} />

<section class="app-surface rounded-2xl p-3 sm:p-4">

  <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <h2 class="text-xl font-semibold">{t('imdg.title', $language)}</h2>
      <p class="app-text-muted text-sm">
        {t('imdg.total', $language)} {total} · {filteredItems.length} / {pageSize} {t('imdg.rows', $language)}
      </p>
    </div>
  </div>

  {#if loading}
    <div class="app-text-muted py-10 text-center text-sm">{t('imdg.loading', $language)}</div>
  {:else}
    <div class="app-surface-soft max-h-[68vh] overflow-auto rounded-xl">
      <table class="app-table min-w-[920px]">
        <colgroup>
          {#each columns as col}
            <col style={`width: ${getColumnWidth(col)}px; min-width: ${getColumnWidth(col)}px;`} />
          {/each}
        </colgroup>
        <thead>
          <tr class="text-left">
            {#each columns as col}
              <th class="px-3 py-2 relative">
                <div class="pr-3">{col}</div>
                <button
                  type="button"
                  class="col-resize-handle"
                  aria-label="Resize column"
                  on:pointerdown={(e) => onResizeHandlePointerDown(e, col)}
                  on:mousedown={(e) => onResizeHandleMouseDown(e, col)}
                ></button>
              </th>
            {/each}
          </tr>
          <tr>
            {#each columns as col}
              <th class="px-3 pt-2 pb-2 text-left">
                {#if isNarrowColumn(col) && activeFilterColumn !== col}
                  <button
                    type="button"
                    class="filter-icon-btn"
                    aria-label={t('imdg.filter', $language)}
                    title={t('imdg.filter', $language)}
                    on:click={() => openNarrowFilter(col)}
                  >
                    ⌕
                  </button>
                {:else}
                  <input
                    id={filterId(col)}
                    class="app-input app-input-inline app-filter-input py-1.5 text-xs"
                    style={`width:${filterInputWidth(col)}px`}
                    placeholder={t('imdg.filter', $language)}
                    value={columnFilters[col] ?? ''}
                    on:focus={() => (focusedFilterColumn = col)}
                    on:blur={() => {
                      focusedFilterColumn = null;
                      if (isNarrowColumn(col)) activeFilterColumn = null;
                    }}
                    on:input={(e) => setColumnFilter(col, (e.currentTarget as HTMLInputElement).value)}
                  />
                {/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#if filteredItems.length === 0}
            <tr>
              <td class="px-3 py-5 text-sm app-text-muted" colspan={Math.max(columns.length, 1)}>
                {t('imdg.noData', $language)}
              </td>
            </tr>
          {:else}
            {#each filteredItems as it}
              <tr class="imdg-row-clickable" on:click={() => openDetails(it)}>
                {#each columns as col}
                  <td class="px-3 py-2 text-sm">{formatCellValue(col, it[col])}</td>
                {/each}
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

  <div class="imdg-pagination mt-3 flex items-center justify-between gap-2">
      <div class="app-text-muted text-sm">{t('imdg.total', $language)} {total}</div>
      <div class="ml-auto flex items-center gap-3">
        <div class="flex items-center gap-2">
          <label for="page" class="app-text-muted text-sm">{t('imdg.page', $language)}</label>
          <input
            id="page"
            type="number"
            bind:value={page}
            min="1"
            max={maxPage}
            class="app-input app-input-inline"
            style="width: 76px"
            on:change={load}
          />

          <label for="pageSize" class="app-text-muted text-sm">{t('imdg.pageSize', $language)}</label>
          <select
            id="pageSize"
            bind:value={pageSize}
            class="app-input app-input-inline"
            style="width: 90px"
            on:change={onPageSizeChange}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <button class="app-btn app-btn-ghost" on:click={goPrev} disabled={page <= 1}>{t('imdg.prev', $language)}</button>
          <button class="app-btn app-btn-ghost" on:click={goNext} disabled={page >= maxPage}>{t('imdg.next', $language)}</button>
        </div>
      </div>
    </div>
  {/if}
</section>

{#if selectedItem}
  <div
    class="imdg-modal-backdrop"
    aria-hidden="true"
    on:pointerdown={(e) => {
      if (e.target === e.currentTarget) closeDetails();
    }}
  >
    <div class="imdg-modal app-surface">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold">{t('imdg.details.title', $language)}</h3>
        <button class="app-btn app-btn-ghost" on:click={closeDetails}>{t('toasts.close', $language)}</button>
      </div>

      <div class="imdg-details-grid">
        {#each detailsEntries as [key, value]}
          <div class="imdg-details-row">
            <div class="app-text-muted text-xs sm:text-sm">{key}</div>
            <div class="imdg-details-value-row">
              <div class="text-sm sm:text-base break-all">{formatCellValue(key, value)}</div>
              <button class="app-btn app-btn-ghost imdg-copy-btn" on:click={() => copyValue(value)}>
                {t('imdg.copy.action', $language)}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
