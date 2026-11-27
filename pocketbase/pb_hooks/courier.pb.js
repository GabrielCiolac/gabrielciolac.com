/// <reference path="../pb_data/types.d.ts" />
// RSS 2.0 feed of The Courier, served at /api/courier/feed.xml (the site maps /feed.xml to it).
routerAdd('GET', '/api/courier/feed.xml', (e) => {
  const SITE = 'https://gabrielciolac.com';
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cdata = (s) => '<![CDATA[' + String(s || '').split(']]>').join(']]]]><![CDATA[>') + ']]>';
  const strip = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const rfc822 = (d) => new Date(String(d).replace(' ', 'T')).toUTCString();
  const posts = e.app.findRecordsByFilter('posts', 'published = true && published_at <= {:now}', '-published_at', 20, 0, { now: new DateTime() });
  const items = posts.map((p) => {
    const link = SITE + '/#courier/' + encodeURIComponent(p.getString('slug'));
    const summary = p.getString('excerpt') || strip(p.getString('body')).slice(0, 280);
    return '<item><title>' + esc(p.getString('title')) + '</title><link>' + esc(link) + '</link>'
      + '<guid isPermaLink="false">courier-' + esc(p.id) + '</guid><pubDate>' + rfc822(p.getString('published_at')) + '</pubDate>'
      + '<description>' + esc(summary) + '</description><content:encoded>' + cdata(p.getString('body')) + '</content:encoded></item>';
  });
  const last = posts.length ? rfc822(posts[0].getString('published_at')) : new Date().toUTCString();
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'
    + '<title>The Courier</title><link>' + SITE + '/</link><description>Notes from Gabriel’s room in Toronto.</description><language>en-ca</language>'
    + '<atom:link href="' + SITE + '/feed.xml" rel="self" type="application/rss+xml"/><lastBuildDate>' + last + '</lastBuildDate>'
    + items.join('') + '</channel></rss>';
  e.response.header().set('Content-Type', 'application/rss+xml; charset=utf-8');
  e.response.header().set('Cache-Control', 'public, max-age=600');
  return e.string(200, xml);
});
