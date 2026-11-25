/* POST { phone, name, pin, field, grade } — creates an account. */
const { updateDB, json } = require('./_db.js');

const FA = '۰۱۲۳۴۵۶۷۸۹';
function toEnDigits(s) {
  return String(s || '').replace(/[۰-۹]/g, d => String(FA.indexOf(d)));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'method' });
    const b = req.body || {};
    const phone = toEnDigits(b.phone).replace(/\D/g, '');
    const name = String(b.name || '').trim().replace(/\s+/g, ' ');
    const pin = toEnDigits(b.pin).replace(/\D/g, '');
    const field = String(b.field || '').trim();
    const grade = String(b.grade || '').trim();

    if (!/^09\d{9}$/.test(phone)) return json(res, 400, { error: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود' });
    if (name.length < 3) return json(res, 400, { error: 'نام و نام خانوادگی را کامل وارد کنید' });
    if (!/^\d{4}$/.test(pin)) return json(res, 400, { error: 'رمز باید ۴ رقم باشد' });
    if (!['ریاضی', 'تجربی', 'انسانی'].includes(field)) return json(res, 400, { error: 'رشته را انتخاب کنید' });
    if (!['دهم', 'یازدهم', 'دوازدهم', 'فارغ‌التحصیل'].includes(grade)) return json(res, 400, { error: 'پایه تحصیلی را انتخاب کنید' });

    let duplicate = false;
    let me = null;
    await updateDB(d => {
      const found = d.registrants.find(r => r.phone === phone);
      if (found) { duplicate = true; me = found; return null; }
      me = { phone, name, pin, field, grade, at: new Date().toISOString() };
      d.registrants.push(me);
      return true;
    });

    if (duplicate) {
      if (me.pin !== pin) return json(res, 409, { error: 'این شماره قبلاً با رمز دیگری ثبت شده؛ از «ورود» استفاده کنید' });
      return json(res, 200, { ok: true, user: { phone, name: me.name, field: me.field, grade: me.grade } });
    }
    return json(res, 200, { ok: true, user: { phone, name, field, grade } });
  } catch (e) {
    return json(res, 500, { error: 'خطای سرور، دوباره تلاش کنید' });
  }
};
