---
title: Blog home page
description: A baked blog home page.
template: base
---
Need a seperate home page for your blog? This one's just blog.md, located at /blog. You can replace it with your own content or just use the home page if the whole site is your blog.

<h2>Latest posts</h2>
<ul>
{% set bps = [] %}

{% for post in bps %}
    <li>
        <a href="/{{post.path}}">{{post.title}}</a> - 
        {% if post.metadata.author %}by {{post.metadata.author}}{% endif %} 
        on {{post.published_date | date}}<br>
        {{post.metadata.description}}
    </li>
{% endfor %}
</ul>

Hmmm, what else might someone want to do on their blog home page?
