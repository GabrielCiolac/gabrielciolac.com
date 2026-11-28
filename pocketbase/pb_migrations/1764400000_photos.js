/// <reference path="../pb_data/types.d.ts" />
// The photo book: Gabriel prints photographs in the PocketBase dashboard, optionally writing a note
// on the back of each one. The public only ever sees published prints; nobody but the superuser can
// add, reorder or remove them.
migrate((app) => {
  const photos = new Collection({
    type: 'base',
    name: 'photos',
    listRule: 'published = true',
    viewRule: 'published = true',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: 'file', name: 'image', required: true, maxSelect: 1, maxSize: 12000000,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], thumbs: ['480x0', '1600x0'] },
      { type: 'text', name: 'title', max: 80 },        // e.g. "First snow on the roof"
      { type: 'text', name: 'note', max: 280 },        // written on the back of the print
      { type: 'text', name: 'place', max: 80 },
      { type: 'date', name: 'taken_at' },
      { type: 'number', name: 'order' },               // 1, 2, 3… leaves the rest newest-first
      { type: 'bool', name: 'published' },
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE INDEX idx_photos_pub ON photos (published, order, taken_at)',
    ],
  });
  app.save(photos);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('photos'));
});
