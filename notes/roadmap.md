# Roadmap

# Pre 1.0 yet

 - [x] get the cli working
 - [x] confirm loading pages and assets
 - [x] confirm the templating system working
 - [x] Figure out secure eval of components from db
 - [x] pre-render pages
 - [x] markdown and template rendering complimenting each other
 - [x] baker functions working in templates - with tests
 - [x] ensure baked directory is copied to the project on build
 - [ ] absurdsql working to store database on client
 - [ ] image assets tested
 - [x] pwa working
 - [ ] app working offline for all pages
 - [ ] confirm lighthouse scores are good
 - [ ] confirm the build process is fast
 - [x] comprehensive testing
 - [x] tests for filters
 - [x] suite of tests for pre-rendering (ensure it isn't escaped)


## Static site things

- [x] Creating new site should prompt for things in site.yaml
- [x] Add support for multiple authors
- [x] add support for categories
- [/] Add support for tags
- [ ] Add example for RSS feeds - as a page
- [ ] Add search
- [ ] Add example sitemap
- [ ] Custom for 404 and 500 pages
- [ ] robots.txt - as page


## Framework things

 - [ ] full text search
 - [x] generalize collections - like blog posts but general
 - [ ] Image assets and others can be loaded into the database optionally
 - [ ] Image processing (resizing, and setting default size and bg color before loading)
 - [ ] introduce a cache for image processing (so you don't have to redo them all each time)
 - [ ] add a /js type asset?
 - [ ] introduce site config 
 - [ ] Add support for plugins (hooks into the build process)
 - [ ] Docs - as an example of the framework too
 - [ ] research Baked Architecture (https://simonwillison.net/2021/Jul/28/baked-data/)
 - [ ] improve the templating system (needed?)
 - [ ] cms interface? - headless?  - netlifyCMS?
 - [ ] easy launch for netlify? - is there a way to package a netlify project and make it easy for someone to just launch a new baked site?
 - [ ] updating from sqlite server (cache api requests? - have the app poll for changes but pasted on the last date it has in the database - this makes the responses cachable)
 - [ ] Incremental Static Regeneration (https://vercel.com/docs/functions/incremental-static-regeneration, https://www.smashingmagazine.com/2021/04/incremental-static-regeneration-nextjs/)
 - [ ] Load ahead - instead of load all (just load the pages that are linked from the current page - not the whole site)
 - [ ] Create a "gallery" component example


## Future considerations

 - [ ] Diff version?  - see [notes.md](notes.md)
 - [ ] use Svelte instead of nunjucks?
 - [ ] change "types" to mimetypes
