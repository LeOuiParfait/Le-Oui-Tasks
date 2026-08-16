import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/server-auth'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const caller = await verifyAuth(request)
    if (!caller) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const body = await request.json()
    const { to, title, message, actionUrl, actionLabel } = body

    if (!to || !title || !message) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 })
    }

    try {
      await sendEmail(to, title, message, actionUrl, actionLabel)
    } catch (emailErr: any) {
      console.warn('[Notifications] Email delivery failed:', emailErr.message)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Notifications] Error sending email:', error)
    return NextResponse.json({
      error: error.message || 'Erreur lors de l\'envoi de la notification.'
    }, { status: 500 })
  }
}
