/* Chat messages — strict per-user privacy: a caller only ever sees its own thread.
   GET  ?phone=&pin=            → that user's thread only
   POST { phone, pin, text }    → user message into their own thread
   GET  ?key=<ADMIN_KEY>        → all threads (admin)
   POST { key, phone, text }    → admin reply into a thread */
const { readDB, updateDB, json } = require('./_db.js');

const FA = '۰۱۲۳۴۵۶۷۸۹';
function toEnDigits(s) {
  return String(s || '').replace(/[۰-۹]/g, d => String(FA.indexOf(d)));
}

function authUser(d, phone, pin) {
  const me = d.registrants.find(r => r.phone === phone);
  return me && me.pin === pin ? me : null;
}

function isAdmin(key) {
  return key && process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const q = url.searchParams;

    if (req.method === 'GET') {
      const key = q.get('key');
      if (isAdmin(key)) {
        const { data } = await readDB();
        return json(res, 200, { admin: true, registrants: data.registrants.map(r => ({ phone: r.phone, name: r.name, field: r.field, grade: r.grade, at: r.at })), threads: data.threads });
      }
      const phone = toEnDigits(q.get('phone')).replace(/\D/g, '');
      const pin = toEnDigits(q.get('pin')).replace(/\D/g, '');
      const { data } = await readDB();
      if (!authUser(data, phone, pin)) return json(res, 401, { error: 'احراز هویت نشد' });
      return json(res, 200, { admin: false, thread: data.threads[phone] || [] });   /* own thread ONLY */
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const text = String(b.text || '').trim().slice(0, 1000);
      if (!text) return json(res, 400, { error: 'متن پیام خالی است' });
      const at = new Date().toISOString();

      if (isAdmin(b.key)) {
        const phone = toEnDigits(b.phone).replace(/\D/g, '');
        if (!phone) return json(res, 400, { error: 'کاربر مشخص نیست' });
        await updateDB(d => {
          if (!d.threads[phone]) d.threads[phone] = [];
          d.threads[phone].push({ from: 'admin', text, at });
          return true;
        });
        return json(res, 200, { ok: true });
      }

      const phone = toEnDigits(b.phone).replace(/\D/g, '');
      const pin = toEnDigits(b.pin).replace(/\D/g, '');
      let ok = false;
      await updateDB(d => {
        if (!authUser(d, phone, pin)) return null;
        if (!d.threads[phone]) d.threads[phone] = [];
        d.threads[phone].push({ from: 'user', text, at });
        ok = true;
        return true;
      });
      if (!ok) return json(res, 401, { error: 'احراز هویت نشد' });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'method' });
  } catch (e) {
    return json(res, 500, { error: 'خطای سرور: ' + (e && e.message || 'نامشخص') });
  }
};
