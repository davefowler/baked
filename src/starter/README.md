# Your Baked Site

Welcome to your freshly prepared Baked site! Just like a good recipe, we've mixed together all the ingredients you need for a delicious website that's fast, reliable, and works offline.

## Kitchen Instructions

### Baking Your Site

Time to put your site in the oven! You can use either of these commands:

```bash
bake build     # for developers
bake site      # for chefs
```

This will:

- Mix together all your content from `/pages`
- Fold in your assets from `/assets`
- Bake everything into the `/dist` directory
- Package it all into a tasty SQLite database (`/dist/baked/baked.db`)

Want to include your works in progress? Add the drafts to the mix:

```bash
bake build --drafts
```

### Taste Testing (Development Server)

Ready to sample your creation?

```bash
bake serve
```

This will start your local tasting station. (Yes, `serve` works for both coders and chefs - it's a double entendre!)

## Recipe Structure

```
├── pages/          # Your main ingredients (content)
│   └── blog/       # Blog posts (like a collection of recipes!)
├── assets/         # Your pantry
│   ├── images/     # Visual garnishes
│   ├── components/ # Kitchen tools
│   ├── css/        # Your plating style
│   └── templates/  # Your tried-and-true recipes
├── public/         # Ready-to-serve items
└── site.yaml       # Your master recipe book
```

After baking, everything comes out fresh in the `/dist` directory:

```
dist/
├── *.html         # Your ready-to-serve pages
├── images/        # Prepared garnishes
└── baked/
    ├── sw.js      # Kitchen helper (service worker)
    ├── offline.html
    └── baked.db   # Your complete cookbook
```

## Special Features

- **Fast Service**: After the first serving, all pages are instantly available to the user
- **Always Available**: Works even when the internet is down (like a good cookbook should!)
- **Search Everything**: Search for your entire site content is built in
- **Flexible Templates**: Customize your recipes with our Nunjucks template system
- **Asset Management**: Everything organized neatly, baked into a sqlite pie.

## Starting Fresh

Creating a new site? Use either:

```bash
bake new       # for developers
bake starter   # for culinary enthusiasts
```

## Learn More

To perfect your recipe:

- Check `site.yaml` for your base ingredients
- Explore `/assets/templates` for cooking techniques
- Read the full recipe guide in the Baked project documentation

Now get cooking! 👩‍🍳👨‍🍳

_Remember: Whether you prefer to think of it as coding or cooking, Baked serves up websites that are **fully baked** and ready to go!_
