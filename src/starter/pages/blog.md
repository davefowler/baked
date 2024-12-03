---
title: Blog home page
description: A baked blog home page.
template: base
---

# This is my blog

Need a seperate home page for your blog? This one's just blog.md, located at /blog. You can replace it with your own content or just use the home page if the whole site is your blog.

<h2>Latest posts</h2>
<ul>
    ${baker.getLatestPosts(100).map(post => `   
    <li><a href="/blog/${post.slug}">${post.title}</a> - by ${post.metadata?.author} on ${post.published_date}<br>${post.metadata?.description}</li>
    `).join('')}
</ul>

Hmmm, what else might someone want to do on their home page?
