# Baked Notes


## Future considerations

### Diff store

What if what was put into the database was really a diff of the end html pages and to render them you simply run a diff.

Each page would then just store what was different about it and also a link to the orig page (or some template).

There could be a configurable or automatically generated diff map to tell it which files to diff from eachother.

This would have the most flexible applications - it could then work with any static site generator - it'd just run it on a dist directory.



