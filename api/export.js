/* Excel export of the registrants (admin only).
   GET /api/export?key=<ADMIN_KEY> → styled .xlsx (RTL sheet, name first column,
   right-aligned cells, colored header, frozen header row) */
const ExcelJS = require('exceljs');
const { readDB, json } = require('./_db.js');

function isAdmin(key) {
  return key && process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'method' });
    const url = new URL(req.url, 'http://x');
    if (!isAdmin(url.searchParams.get('key'))) return json(res, 401, { error: 'unauthorized' });

    const { data } = await readDB();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Noknban Admin';
    const ws = wb.addWorksheet('ثبت‌نام‌ها', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
    });
    ws.columns = [
      { header: 'نام و نام خانوادگی', key: 'name', width: 30 },
      { header: 'شماره موبایل', key: 'phone', width: 18 },
      { header: 'رشته', key: 'field', width: 12 },
      { header: 'پایه تحصیلی', key: 'grade', width: 14 },
      { header: 'تاریخ ثبت‌نام', key: 'at', width: 28 }
    ];

    const header = ws.getRow(1);
    header.height = 28;
    header.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2351' } };
      c.font = { bold: true, size: 12, color: { argb: 'FFFFD65C' } };
      c.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
      c.border = { bottom: { style: 'medium', color: { argb: 'FFF5B841' } } };
    });

    const faDate = iso => {
      try {
        return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
          + ' — ' + new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      } catch (e) { return ''; }
    };

    const rows = data.registrants.slice().reverse();   // newest first, like the admin panel
    rows.forEach((r, i) => {
      const row = ws.addRow({
        name: r.name || '',
        phone: '\u200F' + (r.phone || ''),   // RTL mark so Excel right-aligns the digits
        field: r.field || '',
        grade: r.grade || '',
        at: faDate(r.at)
      });
      row.height = 22;
      row.eachCell(c => {
        c.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
        c.font = { size: 11, color: { argb: 'FF101C33' } };
        c.border = {
          bottom: { style: 'hair', color: { argb: 'FFD8DEE9' } },
          right: { style: 'hair', color: { argb: 'FFD8DEE9' } },
          left: { style: 'hair', color: { argb: 'FFD8DEE9' } }
        };
        if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5FA' } };
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="noknban-registrants.xlsx"');
    res.setHeader('Cache-Control', 'no-store');
    res.end(Buffer.from(buf));
  } catch (e) {
    return json(res, 500, { error: 'خروجی اکسل ساخته نشد' });
  }
};
