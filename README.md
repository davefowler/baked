# Baked -> A Baked Data Site Framework

Baked is a framework for building sites with [Baked Data Architecture](https://bakeddata.org).  It's like a static site generator and will pre-render your full site to be easily hosted on a CDN.  It will also though bundle your full site into a Progressive Web Application (PWA) for instant loading and offline access.  It bakes your full site into a single sqlite database that's persisted on the client side with AbsurdSQL.  As a user navigates around your site, the front end client automatically loads the content stored locally.


## Benefits

 - Fast as possible first load - all pages are pre-rendered to a single HTML file
 - Instant 2nd page load - after 1st page load, the data.sql sqlite file containing the full site is loaded into the client's browser.  All following loads are served from the local sqlite file, so they are super fast.
 - Offline access - since the sqlite file is persisted on the client side, the site works offline.
 - PWA - as the baked sites are Progressive Web Applications they can be installed on a desktop or mobile device and run like a native app.
 - Search - even offline, a great full text search of your full site is available

## Installation

```bash
npm install
```

## Usage

Create a new site:
```bash
npm run start new my-site
```

Build the site:
```bash
npm run start build
```

Start development server:
```bash
npm run start serve
```

## Development

Build the project:
```bash
npm run build
```

Run tests:
```bash
npm test
```
