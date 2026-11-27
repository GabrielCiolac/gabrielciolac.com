/// <reference path="../pb_data/types.d.ts" />
// The Courier: Gabriel's blog, written in the PocketBase dashboard. The public only sees posts that are
// published and whose date has arrived; nobody but the superuser can write.
migrate((app) => {
  const posts = new Collection({
    type: 'base',
    name: 'posts',
    listRule: 'published = true && published_at <= @now',
    viewRule: 'published = true && published_at <= @now',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: 'text', name: 'title', required: true, max: 120 },
      { type: 'text', name: 'slug', required: true, max: 80, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      { type: 'text', name: 'excerpt', max: 300 },
      { type: 'editor', name: 'body', required: true, maxSize: 200000, convertURLs: false },
      { type: 'file', name: 'cover', maxSelect: 1, maxSize: 3000000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], thumbs: ['800x0'] },
      { type: 'bool', name: 'published' },
      { type: 'date', name: 'published_at', required: true },
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)',
      'CREATE INDEX idx_posts_pub ON posts (published, published_at)',
    ],
  });
  app.save(posts);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('posts'));
});
