import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email requis.' }, { status: 400 })
    }

    const auth = getAdminAuth()
    const db = getAdminFirestore()

    // Resolve Firebase UID for this email
    let uid: string | null = null
    try {
      const userRecord = await auth.getUserByEmail(email)
      uid = userRecord.uid
    } catch {
      // SÉCURITÉ : Message générique pour éviter l'énumération d'utilisateurs
      return NextResponse.json({ 
        success: true, 
        message: 'Si cet e-mail existe, un lien de réinitialisation a été envoyé.' 
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://tasks.leouiparfait.com'
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await db.collection('passwordResets').doc(token).set({
      userId: uid,
      email,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    })

    const link = `${appUrl}/reset-password#token=${token}`

    try {
      await sendEmail(
        email,
        'Réinitialisation de votre mot de passe',
        'Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.',
        link,
        'Réinitialiser mon mot de passe'
      )
    } catch (emailErr: any) {
      console.warn('[SMTP] Failed to send password reset email:', emailErr.message)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Si cet e-mail existe, un lien de réinitialisation a été envoyé.' 
    })
  } catch (error: any) {
    console.error('[Auth] Error in forgot-password:', error)
    return NextResponse.json({ 
      error: error.message || 'Erreur serveur.' 
    }, { status: 500 })
  }
}
