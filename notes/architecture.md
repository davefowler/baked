## Baked Site Architecture

This is a static site generator that can run fully in the browser.  It's a baked architecture - wrapping all assets, content, templates and content into a single sqlite database that's loaded into the browser and persisted with AbsurdSQL (a sqlite implementation that runs ontop of IndexedDB).  

The site is a PWA and can work offline.  It's designed to be a starting point for building a blog, documentation site, or other static site.  It's designed to be simple and easy to understand and modify.


## Scafolding 

When creating a new site, the basic scafolding is setup with a simple cli command:

```bash
bake new <site directory>
```

creates the following structure

 - /pages
   - /blog
 - /assets
   - /images
   - /components
   - /css
   - /templates
 - /dist # the output folder of the files that will be served after running the build command
   - /images # processed images that aren't loaded directly into the database
   - /baked # files for the client side pwa 
     - /sw.js # the service worker file
     - /offline.html # the offline page
     - /baked.db # the sqlite database
   - *.html # pre-rendered website pages
 - /package.json
 - /site.yaml # config variables for the site


By default a few example pages and blog posts are created to get the user started.


## Loading 

When the build command is run, it first creates a sqlite database and loads everything the site needs into it.  This includes the pages, assets, templates, and content.  The database is structured in two tables:

**pages** # a row for each page in the site.  This is all loaded from the pages folder.

```sql
CREATE TABLE IF NOT EXISTS pages (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    template TEXT NOT NULL,
    metadata TEXT,
    published_date TEXT
            );
```

**assets** # a row for each asset in the site.  This is all loaded from the assets folder.

```sql
CREATE TABLE IF NOT EXISTS assets (
    path TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT NOT NULL
);
```

Note that there are many different types of assets including images, css, components, and templates.  In the future you will also be able to create custom assets.  

As each asset or page is loaded, it's corresponding loader is used to preprocess the file content before entering the database.  In the future these loaders will be customizable.

### Metadata

For pages, metadata will be loaded from the frontmatter of the files that are processed, and also from any meta.yaml files in the directories above the page file.  The meta.yaml file allows you to set default metadata for an entire directory.  For instance the blog directory has a meta.yaml file that sets the default template to be used for all the pages.

/blog/meta.yaml

```yaml
template: blog.html
type: blog
```


## Templates

Templates in Baked use Nunjucks, a powerful templating language inspired by Jinja2. This provides a secure, feature-rich templating system with inheritance, macros, filters and more. Templates are HTML files with Nunjucks syntax for dynamic content.

Template inheritance is handled through Nunjucks' native extend/block system. Child templates can extend parent templates and override specific blocks.

For example:

base.html:
```html
<html>
  <body>
    <nav>{{ site.title }}</nav>

    <div id="content">
      {% block content %}{% endblock %}
    </div>

    <footer>
      {% block footer %}
        <p>© {{ site.title }}</p>
      {% endblock %}
    </footer>
  </body>
</html>
```

blog.html:
```html
{% extends "base.html" %}

{% block content %}
  <article>
    <h1>{{ page.title }}</h1>
    <time>{{ page.date | date }}</time>
    {{ page.content | safe }}
  </article>
{% endblock %}
```

### Template Context

Templates have access to these variables:
- `page`: The current page object (title, content, metadata, etc)
- `site`: Global site configuration from site.yaml
- `baker`: Helper object for querying other pages/assets

### Nunjucks Features Available
- Template inheritance with `extends` and `block`
- Include other templates with `include`
- Macros for reusable components
- Built-in filters for formatting (date, safe, etc)
- Custom filters can be added
- Conditional logic and loops
- Whitespace control

### Variables available in templates

There are 3 objects passed to the templates on render:

 - site # the data from the site.yaml file, including the title, description, and what ever else you want to add
 - page # the current page object from the database that is being rendered
   - title
   - content
   - metadata # loaded from meta.yaml dirs and frontmatter of the pages
   - template
   - slug
   - published_date
 - baker # a helper object with some useful functions
   - init(db) # initialize the baker object with the given database (client or server side sqlite db)
   - getAsset(type, name) # fetch an asset from the database as a component
   - getRawAsset(slug) # fetch the raw asset from the database without wrapping it in it's component
   - getPage(slug) # fetch a page from the database
   - getLatestPages(limit=10, offset=0) # fetch the latest pages from the database
   - getPrevPage(currentPage) # fetch the previous page from the database
   - getNextPage(currentPage) # fetch the next page from the database
   - renderPage(page) # render a page to html
   - search(query, limit=10) # search the database for pages that match the query
   - query(sql, params) # run a sql query on the database and return the results

## Rendering a template

When pre-rendering on the server side, or client side in the browser, when a page is requested it is loaded from the database, and fetches its template and renders it like so 

```js
baker.renderPage = (page) => {
    const template = this.getAsset('template', page.template);
    const renderedTemplate = template(page, this, this.site);
    return renderedTemplate;
};
```

the getAsset call returns the component for the template, which is a function that takes the page, baker and site objects and returns the rendered html.  This works the same on the server side and client.

### Fetching assets and other pages in templates

The baker object is passed into templates and offers a number of helper functions for the most common fetches, and also a generic query function for fetching directly and flexibly with sql.  

```html

Here is a picture of my face ${baker.getAsset('images/myface.png')}

Here is my article [About dogs](${baker.getPage('blog/about-dogs').path})

Latest 5 pages
<ul>
    ${baker.getLatestPages(5).map(latestPage => {
        <li>${latestPage.title}</li>
    })}
</ul>


Nav pages:
${const navPages = baker.getPrevAndNextPages(page); 
<a href="${navPages.prev.path}">Previous</a>
<a href="${navPages.next.path}">Next</a>
}


All images about dogs:
${baker.query('SELECT * FROM assets WHERE type = "image" AND path LIKE "%dog%"').map(image => {
    <img src="${image.path}" />
})}
```


## Components 

Assets and pages are all handled/rendered with the help of components.  The components can be found and modified in the /assets/components folder.  The component files must be named the same as the slug of the "type" of asset.  By default an asset's type is fetched from the name of it's folder in the the /assets directory.  So things in "css" will be of type "css" and handled by the component defined in /assets/components/css.js.

## Pre-rendering

For SEO and the fastes possible initial page loads, each page of the site is pre-rendered into the /dist folder as a single html file.  These files can be served as static files or through a CDN for the fastest possible load times, similar to a traditional static site.


## Baked full page loading

After the initial page load, each pre-rendered page will load a few extra files:

 - /sw.js # the service worker file
 - /baked.db # the sqlite database
 - /offline.html # the offline page

*sw.js* - this is a service worker file that enables the site to be a progressive web application.  This means that it can cache the required assets (this file, the offline.html page) so that it can work offline.  It contains the code necessary to start and run AbsurdSQL - which will persist the baked.db file on the client.  And it will handle all the page rendering for the site.

*offline.html* - this is the page that the user will see if they are offline.  It contains a simple message and a button to refresh the page.  When clicked it will show the browser's standard offline page.

*baked.db* - this is the sqlite database that contains all the pages and assets of the site.  It is the same database that is created when running the build command.

With the full site loaded into the client-side AbsurdSQL database, the user will have instantly responsive experience as they navigate your site.  It will require no additional requests for pages and work offline!


## Future enhancements

 - Load image assets into database optionally - want all images to also work offline?  This could be done by either adding them to the service worker cache or loading them into the database as blobs.
 - SQLite serve incremental updates - it's simple enough to host a sqlite server and have the clients poll for updates incrementally instead of needing to fetch the whole database again when new pages are added.
 - Load ahead (not full site) - for larger sites it may not be practicle to load the full site into the client side db.  It would be simple enough using the sqlite server to fetch just the pages and assets needed for the current page (and linked pages) as the user navigates.  This would still ensure instant loads as the user navigates in almost all cases.



## Benefits of this architecture

 - fastest possible page loads
   - single file initial page load thatnks to [pre-rendering](#pre-rendering)
   - 1 js and 1 sqlite.db file loaded after page load - renders the full rest of the site
 - offline access - works as a pwa
 - incremental updates - loads new pages and assets all together in a single update from sqlite (future)
 - built in search
 - easy extensibility
