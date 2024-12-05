<script>
  export let page;
  export let site;
  export let baker;
</script>

<!doctype html>
<html lang={page.data?.lang || 'en'}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{site.title || 'Site Title'}</title>
    <meta name="description" content={page.data?.description || ''} />
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#000000" />
    <link rel="stylesheet" href="/main.css" />

    <script type="module" src="/baked/baker.js" async></script>
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('baked/sw.js');
      }
    </script>
  </head>
  <body>
    <header>
      <nav>
        <a href="/">Home</a>
        <a href="/blog">Blog</a>
        <a href="/about">About</a>
      </nav>
      {#if page.title}
        <h1>{page.title}</h1>
      {/if}
    </header>
    <main>
      <slot />
    </main>
    <footer>
      <p>Site cooked with Baked</p>
      <nav>
        <a href="/privacy">Privacy Policy</a>
        <a href="/contact">Contact</a>
      </nav>
    </footer>
  </body>
</html>
