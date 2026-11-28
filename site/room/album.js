/* Pure helpers for the photo book: spreads, ordering, and the words on the back of a print.
   Loaded by index.html as window.RoomAlbum and by the tests with require(). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoomAlbum = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PER_SPREAD = 2;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* How many spreads (open pages) a set of prints fills. An empty book still has one open spread. */
  function spreadCount(n, per = PER_SPREAD) { return Math.max(1, Math.ceil(Math.max(0, n) / per)); }

  /* The prints on one spread, left to right. */
  function spreadAt(items, page, per = PER_SPREAD) {
    const start = Math.max(0, page) * per;
    return (items || []).slice(start, start + per);
  }

  function clampPage(page, n, per = PER_SPREAD) {
    return Math.min(Math.max(0, Math.floor(page) || 0), spreadCount(n, per) - 1);
  }

  /* Manual order first (1, 2, 3…), then anything unordered newest first. */
  function orderOf(rec) {
    const n = Number(rec && rec.order);
    return Number.isFinite(n) && n > 0 ? n : Infinity;
  }

  function timeOf(rec) {
    const raw = String((rec && (rec.taken_at || rec.created)) || '').trim();
    if (!raw) return 0;
    const d = new Date(raw.replace(' ', 'T'));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function sortPhotos(items) {
    return (items || []).slice().sort((a, b) => {
      const oa = orderOf(a), ob = orderOf(b);
      if (oa !== ob) return oa - ob;
      return timeOf(b) - timeOf(a);
    });
  }

  /* A print's picture, through the site's own PocketBase proxy. Only thumbs are served (nginx
     rejects the originals), so the picture is resized before it ever reaches the browser and
     whatever EXIF the camera wrote is left behind. */
  function photoUrl(rec, thumb = '1600x0') {
    if (!rec || !rec.id || !rec.image) return '';
    return 'api/files/photos/' + encodeURIComponent(rec.id) + '/' + encodeURIComponent(rec.image)
      + '?thumb=' + encodeURIComponent(thumb);
  }

  function dateLabel(rec) {
    const raw = String((rec && rec.taken_at) || '').trim();
    if (!raw) return '';
    const d = new Date(raw.replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }

  function backMeta(rec) {
    return [String((rec && rec.place) || '').trim(), dateLabel(rec)].filter(Boolean).join(' · ');
  }

  function noteText(rec) {
    return String((rec && rec.note) || '').trim() || 'Nothing written on the back.';
  }

  function altText(rec, index) {
    return String((rec && rec.title) || '').trim() || 'Photograph ' + ((Number(index) || 0) + 1);
  }

  return { PER_SPREAD, spreadCount, spreadAt, clampPage, sortPhotos, photoUrl, dateLabel, backMeta, noteText, altText };
});
