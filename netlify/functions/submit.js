const https = require('https');

function resendPost(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let b;
  try { b = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false }) };
  }

  const { name, phone, email, position, introduction, fileData, fileName, resumeLink } = b;

  const rows = [
    ['姓名', name], ['电话', phone], ['邮箱', email],
    ['应聘岗位', position], ['自我介绍', introduction || '-'],
    ...(resumeLink ? [['简历链接', `<a href="${resumeLink}">${resumeLink}</a>`]] : [])
  ].map(([k, v]) =>
    `<tr><td style="padding:8px 12px;color:#666;white-space:nowrap;border-bottom:1px solid #f0f0f0">${k}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${v || '-'}</td></tr>`
  ).join('');

  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <h2 style="color:#1a6fff;margin-bottom:20px">新简历投递 · DREO</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
    <p style="color:#bbb;font-size:12px;margin-top:24px">来自 dreo-careers.netlify.app</p>
  </div>`;

  const emailPayload = {
    from: 'DREO招聘 <onboarding@resend.dev>',
    to: ['kaia.lyu@dreo.com'],
    reply_to: email || undefined,
    subject: `应聘｜${position || '未知岗位'}`,
    html,
    attachments: fileData ? [{ filename: fileName || 'resume.pdf', content: fileData }] : []
  };

  try {
    const result = await resendPost(emailPayload);
    if (result.status === 200 || result.status === 201) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }
    throw new Error(`Resend ${result.status}: ${result.body}`);
  } catch(err) {
    console.error(err.message);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
