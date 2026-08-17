import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin'
import { verifyAuth } from '@/lib/server-auth'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const caller = await verifyAuth(request)
    if (!caller) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const body = await request.json()
    const { email, firstName, userId } = body

    if (!email) {
      return NextResponse.json({ error: 'Email requis.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    const callerDoc = await db.collection('users').doc(caller.uid).get()
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 })
    }

    const callerData = callerDoc.data()!
    if (callerData.role !== 'super_admin' && callerData.role !== 'admin') {
      return NextResponse.json({ error: 'Seuls les administrateurs peuvent générer des liens d\'activation.' }, { status: 403 })
    }

    const auth = getAdminAuth()
    let uid: string = userId
    if (!uid) {
      try {
        const userRecord = await auth.getUserByEmail(email)
        uid = userRecord.uid
      } catch {
        return NextResponse.json({
          success: true,
          message: 'Si cet e-mail existe, un lien d\'activation a été envoyé.'
        })
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://tasks.leouiparfait.com'
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 heure

    await db.collection('passwordResets').doc(token).set({
      userId: uid,
      email,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    })

    const link = `${appUrl}/reset-password?flow=activate#token=${token}`

    let emailSent = false
    try {
      await sendEmail(
        email,
        'Activation de votre compte - LE LOUI PARFAIT',
        `Bonjour ${firstName || ''},\n\nUn compte a été créé pour vous sur l'espace LE LOUI PARFAIT. Veuillez cliquer sur le bouton ci-dessous pour définir votre mot de passe et activer votre accès.`,
        link,
        'Activer mon compte'
      )
      emailSent = true
    } catch (mailErr: any) {
      console.warn('[Auth] Email sending failed:', mailErr.message)
    }

    return NextResponse.json({
      success: true,
      link,
      emailSent
    })
  } catch (error: any) {
    console.error('[Auth] Error in reset-link:', error)
    return NextResponse.json({
      error: error.message || 'Erreur lors de la génération du lien.'
    }, { status: 500 })
  }
}
