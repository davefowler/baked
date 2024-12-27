---
title: Baked site starter homepage!
description: This is the baked site starter homepage!  Replace this with your own content.
template: base
---

# Hello World!

This is the baked site starter homepage! Replace this with your own content.

You can use [markdown](/blog/markdown-guide) for your content, or use HTML.

Like this line that <b>bolds this text with HTML</b>.

<h2>You can make a list of your latest blog posts like this:</h2>
<ul>
{% set blogPosts = baker.getLatestPages(100, 0, "blog") %}

{% for post in blogPosts %}
<li><a href="/{{post.path}}">{{post.title}}</a></li>
{% endfor %}
</ul>

Hmmm, what else might someone want to do on their home page?
