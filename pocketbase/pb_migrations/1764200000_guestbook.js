/// <reference path="../pb_data/types.d.ts" />
// The guestbook: anyone may sign, nobody but the superuser can approve, and the public only ever
// sees approved entries (and their drawings).
migrate((app) => {
  const gb = new Collection({
    type: 'base',
    name: 'guestbook',
    // visitors can only create, and can't approve themselves
    createRule: '@request.body.approved:isset = false',
    listRule: 'approved = true',
    viewRule: 'approved = true',
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: 'text', name: 'name', required: true, min: 1, max: 40 },
      { type: 'text', name: 'message', required: false, max: 280 },
      { type: 'file', name: 'drawing', required: true, maxSelect: 1, maxSize: 400000, mimeTypes: ['image/png'] },
      { type: 'bool', name: 'approved' },
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
    ],
    indexes: ['CREATE INDEX idx_guestbook_approved ON guestbook (approved, created)'],
  });
  app.save(gb);

  const s = app.settings();
  s.meta.appName = "Gabriel's Guestbook";
  s.trustedProxy.headers = ['CF-Connecting-IP', 'X-Real-IP'];
  s.trustedProxy.useLeftmostIP = false;
  s.rateLimits.enabled = true;
  s.rateLimits.rules = [
    { label: 'guestbook:create', maxRequests: 5, duration: 600, audience: '@guest' },   // 5 tries / 10 min / IP
    { label: '/api/', maxRequests: 120, duration: 60, audience: '' },
  ];
  app.save(s);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('guestbook'));
});
