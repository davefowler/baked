<script>
  import Base from './Base.svelte';
  export let page;
  export let site;
  export let baker;
</script>

<Base {page} {site} {baker}>
  <article>
    {#if page.data?.date}
      <time datetime={page.data.date}>{page.data.date}</time>
    {/if}
    {@html page.content}
  </article>
</Base>
