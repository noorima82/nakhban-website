/* POST { phone, pin } — verifies an existing account. */
const { readDB, json } = require('./_db.js');

const FA = '۰۱۲۳۴۵۶۷۸۹';
function toEnDigits(s) {
  return String(s || '').replace(/[۰-۹]/g, d => String(FA.indexOf(d)));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'method' });
    const b = req.body || {};
    const phone = toEnDigits(b.phone).replace(/\D/g, '');
    const pin = String(b.pin || '').trim();
    if (!/^09\d{9}$/.test(phone) || !pin) {
      return json(res, 400, { error: 'شماره یا رمز اشتباه است' });
    }
    const { data } = await readDB();
    const me = data.registrants.find(r => r.phone === phone);
    if (!me || me.pin !== pin) return json(res, 401, { error: 'حسابی با این شماره و رمز پیدا نشد' });
    return json(res, 200, { ok: true, user: { phone, name: me.name, field: me.field, grade: me.grade } });
  } catch (e) {
    return json(res, 500, { error: 'ارتباط با سرور برقرار نشد؛ چند لحظه بعد دوباره تلاش کن' });
  }
};
