<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { getSources } from '../sources/index.js';
  import { itemToText, dayToText } from '../sources/casper.js';
  import { fetchExtraction, countWords, sectionsToText } from '../extract-client.js';

  const dispatch = createEventDispatcher();
  const sources = getSources();
  let source = sources[0];

  let days = [];
  let day = '';
  let items = [];
  let loading = false;
  let error = '';

  // Preview state (full-article mode)
  let preview = null; // { item, link, title, kind, sections }
  let extracting = false;
  let previewError = '';

  $: keptText = preview ? sectionsToText(preview.sections) : '';
  $: keptWords = countWords(keptText);

  async function loadDay(d) {
    loading = true; error = '';
    try { items = await source.getDay(d); }
    catch (e) { error = e.message; items = []; }
    finally { loading = false; }
  }

  onMount(async () => {
    loading = true;
    try {
      days = await source.listDays();
      day = days[0] || '';
      if (day) await loadDay(day);
    } catch (e) { error = e.message; }
    finally { loading = false; }
  });

  function readSummary(item) {
    dispatch('load', { text: itemToText(item), segments: [itemToText(item)], title: item.title });
  }
  function readAllSummaries() {
    dispatch('load', { text: dayToText(items), segments: items.map(itemToText), title: `${source.name} ${day}` });
  }

  async function openFull(item, link) {
    extracting = true; previewError = ''; preview = null;
    try {
      const data = await fetchExtraction(link.url);
      preview = { item, link, title: data.title || link.title, kind: data.kind, sections: data.sections.map(s => ({ ...s })) };
    } catch (e) {
      previewError = e.message;
      preview = { item, link, title: link.title, kind: 'error', sections: [] };
    } finally {
      extracting = false;
    }
  }

  function toggleSection(i, checked) {
    preview.sections[i].skip = !checked;
    preview = preview;
  }

  function readFull() {
    dispatch('load', { text: keptText, title: preview.title });
  }
  function readFallbackSummary() {
    dispatch('load', { text: itemToText(preview.item), title: preview.item.title });
  }
</script>

<div class="panel">
  <div class="panel-header">
    <h3>{preview ? 'Preview' : source.name}</h3>
    <button class="close-icon" on:click={() => dispatch('close')} title="Close">✕</button>
  </div>

  {#if extracting}
    <p class="msg">Extracting article…</p>
  {:else if preview}
    <button class="link-btn" on:click={() => { preview = null; previewError = ''; }}>← Back to list</button>
    <h4>{preview.title}</h4>
    <a class="orig" href={preview.link.url} target="_blank" rel="noopener noreferrer">Open original</a>

    {#if previewError}
      <p class="msg err">{previewError}</p>
      <button class="btn-primary" on:click={readFallbackSummary}>Read the summary instead</button>
    {:else}
      <p class="msg">{keptWords.toLocaleString()} words selected ({preview.kind})</p>
      <ul class="sections">
        {#each preview.sections as s, i}
          <li>
            <label>
              <input type="checkbox" checked={!s.skip} on:change={(e) => toggleSection(i, e.target.checked)} />
              <span class="heading">{s.heading}</span>
              <span class="count">{countWords(s.text).toLocaleString()} w{s.reason ? ` · ${s.reason}` : ''}</span>
            </label>
          </li>
        {/each}
      </ul>
      <button class="btn-primary" disabled={!keptWords} on:click={readFull}>Read selected</button>
    {/if}
  {:else}
    {#if days.length}
      <select bind:value={day} on:change={() => loadDay(day)} disabled={loading}>
        {#each days as d}<option value={d}>{d}</option>{/each}
      </select>
    {/if}

    {#if loading}<p class="msg">Loading…</p>{/if}
    {#if error}<p class="msg err">{error}</p>{/if}

    {#if items.length}
      <button class="btn-primary all" on:click={readAllSummaries}>Read all {items.length} summaries</button>
      <ul class="items">
        {#each items as item}
          <li>
            <div class="meta">{item.tag}</div>
            <div class="title">{item.title}</div>
            <div class="actions">
              <button class="chip" on:click={() => readSummary(item)}>Summary</button>
              {#each item.links as l}
                <button class="chip" on:click={() => openFull(item, l)} title={l.url}>Full: {l.title}</button>
              {/each}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .panel { background:#111; border:1px solid #333; border-radius:12px; padding:1.5rem; width:100%; max-width:560px; max-height:80vh; overflow:auto; box-sizing:border-box; }
  .panel-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
  h3 { margin:0; font-weight:500; color:#fff; font-size:1.1rem; }
  h4 { color:#fff; font-weight:500; margin:.75rem 0 .25rem; }
  .close-icon { background:transparent; border:none; color:#666; cursor:pointer; font-size:1rem; }
  .close-icon:hover { color:#fff; }
  select { width:100%; background:#1a1a1a; color:#fff; border:1px solid #333; border-radius:8px; padding:.6rem; margin-bottom:1rem; font-size:16px; }
  .msg { color:#aaa; font-size:.9rem; } .err { color:#ff4444; }
  .btn-primary { width:100%; padding:.75rem; background:#ff4444; border:none; border-radius:8px; color:#fff; font-weight:500; cursor:pointer; margin:.5rem 0 1rem; }
  .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
  .link-btn { background:none; border:none; color:#888; cursor:pointer; padding:0; }
  .link-btn:hover { color:#fff; }
  .orig { color:#888; font-size:.8rem; }
  ul { list-style:none; margin:0; padding:0; }
  .items li { border-top:1px solid #222; padding:.75rem 0; display:flex; flex-direction:column; gap:.4rem; }
  .meta { color:#666; font-size:.75rem; text-transform:uppercase; }
  .title { color:#fff; font-size:.95rem; }
  .actions { display:flex; flex-wrap:wrap; gap:.4rem; }
  .chip { background:#1a1a1a; border:1px solid #333; border-radius:999px; color:#bbb; font-size:.8rem; padding:.3rem .7rem; cursor:pointer; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .chip:hover { border-color:#ff4444; color:#fff; }
  .sections li { padding:.4rem 0; border-top:1px solid #222; }
  .sections label { display:flex; gap:.6rem; align-items:center; color:#ddd; cursor:pointer; }
  .heading { flex:1; font-size:.9rem; }
  .count { color:#666; font-size:.75rem; }
</style>
