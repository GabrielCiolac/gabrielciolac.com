/// <reference path="../pb_data/types.d.ts" />
// Drawings of guestbook entries that haven't been approved yet are only served to the superuser
// (the dashboard previews files with a short-lived file token), so nobody can share a link to an
// unapproved drawing hosted on the site.
onFileDownloadRequest((e) => {
  if (e.collection.name === 'guestbook' && !e.record.getBool('approved')) {
    let allowed = e.hasSuperuserAuth();
    if (!allowed) {
      const token = (e.requestInfo().query || {})['token'];
      if (token) {
        try { allowed = e.app.findAuthRecordByToken(token, 'file').isSuperuser(); } catch (err) { allowed = false; }
      }
    }
    if (!allowed) throw new NotFoundError();
  }
  e.next();
}, 'guestbook');
