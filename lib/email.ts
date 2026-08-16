import nodemailer from 'nodemailer'

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://tasks.leouiparfait.com'
const LOGO_URL = `${APP_BASE_URL}/logo-horizontal.png`

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

function emailLogoHtml(): string {
  if (!LOGO_URL) return '<h2 style="margin:0;color:#887D93;font-size:24px;font-weight:700;">LE LOUI PARFAIT</h2>'
  return `<img src="${LOGO_URL}" alt="LE LOUI PARFAIT" style="height:48px;width:auto;display:inline-block;" />`
}

export async function sendEmail(to: string, subject: string, message: string, actionUrl?: string, actionLabel?: string) {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const fromEmail = process.env.FROM_EMAIL || smtpUser

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP configuration missing')
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  })

  const actionButton = actionUrl && actionLabel ? `
    <p style="text-align:center;margin:0 0 32px;">
      <a href="${actionUrl}" style="background:#887D93;color:#fff;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:15px;">
        ${escapeHtml(actionLabel)}
      </a>
    </p>
    <p style="font-size:13px;color:#a8a29e;margin:0 0 12px;">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
    </p>
    <p style="margin:0;word-break:break-all;background:#f5f3f6;border:1px solid #ebe7ee;border-radius:8px;padding:12px;font-size:13px;">
      <a href="${actionUrl}" style="color:#6b5f78;">${actionUrl}</a>
    </p>
  ` : ''

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
      <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
        <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
          <tr><td align="center">
            <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
              <tr>
                <td style="background:#fff;padding:40px;text-align:center;border-bottom:1px solid #f0efef;">
                  ${emailLogoHtml()}
                  <p style="margin:8px 0 0;color:#78716c;font-size:13px;font-weight:400;">Espace de travail collaboratif</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px;">
                  <p style="font-size:16px;color:#1c1917;margin:0 0 16px;font-weight:600;">Bonjour,</p>
                  <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0 0 24px;">${escapeHtml(message)}</p>
                  ${actionButton}
                  <div style="margin-top:32px;padding-top:24px;border-top:1px solid #ebe7ee;">
                    <p style="font-size:12px;color:#a8a29e;margin:0;line-height:1.6;">
                      © ${new Date().getFullYear()} LE LOUI PARFAIT. Tous droits réservés.
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `

  await transporter.sendMail({
    from: `"LE LOUI PARFAIT" <${fromEmail}>`,
    to,
    subject,
    html
  })
}
