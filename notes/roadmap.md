# Roadmap

# Pre 1.0 yet

 - [x] get the cli working
 - [x] confirm loading pages and assets
 - [x] confirm the templating system working
 - [x] Figure out secure eval of components from db
 - [x] pre-render pages
 - [ ] absurdsql working to store database on client
 - [ ] image assets 
 - [ ] pwa working
 - [ ] app working offline for all pages
 - [ ] confirm lighthouse scores are good
 - [ ] confirm the build process is fast
 - [ ] make components have both loading and rendering functions
 - [ ] comprehensive testing
 - [ ] change "types" to mimetypes
 - [ ] tests for filters


## Static site things

- [ ] Creating new site should prompt for things in site.yaml
- [ ] Add support for multiple authors
- [ ] Add support for tags
- [ ] Add support for comments
- [ ] Add support for RSS feeds
- [ ] Add support for search
- [ ] Add support for sitemaps
- [ ] Add support for 404 and 500 pages
- [ ] Add support for robots.txt



## Framework things

 - [ ] full text search
 - [ ] generalize collections - like blog posts but general
 - [ ] Image assets and others can be loaded into the database optionally
 - [ ] Image processing (resizing, and setting default size and bg color before loading)
 - [ ] introduce a cache for image processing (so you don't have to redo them all each time)
 - [ ] add a /js type asset?
 - [ ] introduce site config 
 - [ ] Add support for plugins (hooks into the build process)
 - [ ] Docs - as an example of the framework too
 - [ ] research Baked Architecture (https://simonwillison.net/2021/Jul/28/baked-data/)
 - [ ] improve the templating system (needed?)
 - [ ] cms interface?
 - [ ] updating from sqlite server (cache api requests? - have the app poll for changes but pasted on the last date it has in the database - this makes the responses cachable)
 - [ ] Incremental Static Regeneration (https://vercel.com/docs/functions/incremental-static-regeneration, https://www.smashingmagazine.com/2021/04/incremental-static-regeneration-nextjs/)
 - [ ] Load ahead - instead of load all (just load the pages that are linked from the current page - not the whole site)
 - [ ] Create a "gallery" component example


## Future considerations

 - [ ] Diff version?  - see [notes.md](notes.md)
 - [ ] use Svelte instead of nunjucks?