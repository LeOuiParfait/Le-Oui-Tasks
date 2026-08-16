import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { verifyAuth } from '@/lib/server-auth'
import nodemailer from 'nodemailer'

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://tasks.leouiparfait.com'
const LOGO_URL = `${APP_BASE_URL}/logo-horizontal.png`

function escapeHtml(text: unknown): string {
  if (text == null) return ''
  const str = String(text)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function emailLogoHtml(): string {
  if (!LOGO_URL) return '<h2 style="margin:0;color:#887D93;font-size:24px;font-weight:700;">LE LOUI PARFAIT</h2>'
  return `<img src="${LOGO_URL}" alt="LE LOUI PARFAIT" style="height:48px;width:auto;display:inline-block;" />`
}

export async function POST(request: NextRequest) {
  try {
    const caller = await verifyAuth(request)
    if (!caller) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const db = getAdminFirestore()
    const callerDoc = await db.collection('users').doc(caller.uid).get()
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 })
    }

    const callerRole = callerDoc.data()!.role
    if (!['super_admin', 'admin', 'manager', 'team_lead'].includes(callerRole)) {
      return NextResponse.json({ error: 'Vous n\'avez pas le droit d\'envoyer des rapports.' }, { status: 403 })
    }

    const body = await request.json()
    const { reportId, recipients, reportData } = body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Destinataires manquants.' }, { status: 400 })
    }

    const invalidEmail = recipients.find((e: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    if (invalidEmail) {
      return NextResponse.json({ error: `E-mail invalide : ${invalidEmail}` }, { status: 400 })
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const fromEmail = process.env.FROM_EMAIL || smtpUser || 'reports@tasking.app'

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="fr">
        <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
          <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
            <tr><td align="center">
              <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
                <tr>
                  <td style="background:#fff;padding:32px 40px;text-align:center;border-bottom:1px solid #f0efef;">
                    ${emailLogoHtml()}
                    <h1 style="margin:12px 0 0;color:#1c1917;font-size:22px;font-weight:600;letter-spacing:-0.01em;">Rapport Quotidien</h1>
                    <p style="margin:6px 0 0;color:#78716c;font-size:13px;">${reportData?.date || new Date().toISOString().split('T')[0]}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 40px;">
                    <p style="font-size:14px;color:#57534e;margin:0 0 20px;">
                      Généré par : <strong style="color:#1c1917;">${escapeHtml(reportData?.generatedBy || "Équipe")}</strong>
                    </p>

                    <table width="100%" style="border-collapse:separate;border-spacing:8px 0;margin-bottom:24px;">
                      <tr>
                        <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:33%;">
                          <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${reportData?.attendanceSummary?.present || 0}</p>
                          <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;">Présents</p>
                        </td>
                        <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:33%;">
                          <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${reportData?.tasksSummary?.completed || 0}</p>
                          <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;">Terminées</p>
                        </td>
                        <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:33%;">
                          <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${reportData?.tasksSummary?.inProgress || 0}</p>
                          <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;">En cours</p>
                        </td>
                      </tr>
                    </table>

                    ${
                      reportData?.blockers?.length > 0
                        ? `<div style="background:#fafaf9;border-radius:10px;padding:16px;margin:0 0 24px;">
                            <p style="color:#1c1917;margin:0 0 8px;font-weight:600;font-size:14px;">Blocages</p>
                            <ul style="margin:0;padding-left:20px;color:#78716c;font-size:13px;line-height:1.6;">
                              ${reportData.blockers.map((b: string) => `<li>${escapeHtml(b)}</li>`).join('')}
                            </ul>
                          </div>`
                        : ''
                    }

                    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #ebe7ee;">
                      <p style="font-size:12px;color:#a8a29e;margin:0;line-height:1.6;">
                        © ${new Date().getFullYear()} LE LOUI PARFAIT. Rapport généré automatiquement.
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

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass }
      })

      await transporter.sendMail({
        from: `"LE LOUI PARFAIT" <${fromEmail}>`,
        to: recipients.join(', '),
        subject: `Rapport Quotidien - ${reportData?.date || new Date().toISOString().split('T')[0]}`,
        html: reportHtml
      })
    } else {
      console.warn('[Reports] SMTP non configuré, envoi simulé')
    }

    if (reportId) {
      await db.collection('reports').doc(reportId).update({
        status: 'sent',
        sentAt: new Date().toISOString()
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Reports] Error sending report:', error)
    return NextResponse.json({
      error: error.message || 'Erreur lors de l\'envoi du rapport.'
    }, { status: 500 })
  }
}
