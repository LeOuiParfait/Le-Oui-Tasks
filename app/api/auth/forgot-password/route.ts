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

    console.log('[ForgotPassword] Request for:', email)

    const auth = getAdminAuth()
    const db = getAdminFirestore()

    // Resolve Firebase UID for this email
    let uid: string | null = null
    try {
      const userRecord = await auth.getUserByEmail(email)
      uid = userRecord.uid
      console.log('[ForgotPassword] Found user:', userRecord.uid)
    } catch (userErr: any) {
      // SÉCURITÉ : Message générique pour éviter l'énumération d'utilisateurs
      console.log('[ForgotPassword] User not found or lookup error:', userErr.code || userErr.message)
      return NextResponse.json({
        success: true,
        message: 'Si cet e-mail existe, un lien de réinitialisation a été envoyé.'
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://tasks.leouiparfait.com'
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    try {
      await db.collection('passwordResets').doc(token).set({
        userId: uid,
        email,
        used: false,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      })
      console.log('[ForgotPassword] Reset token saved for:', email)
    } catch (dbErr: any) {
      console.error('[ForgotPassword] Firestore error:', dbErr.message || dbErr)
      throw dbErr
    }

    const link = `${appUrl}/reset-password#token=${token}`

    try {
      console.log('[ForgotPassword] Sending email to:', email)
      await sendEmail(
        email,
        'Réinitialisation de votre mot de passe',
        'Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.',
        link,
        'Réinitialiser mon mot de passe'
      )
      console.log('[ForgotPassword] Email sent to:', email)
    } catch (emailErr: any) {
      console.warn('[ForgotPassword] SMTP error (email not sent):', emailErr.message)
      // On continue malgré l'échec SMTP pour ne pas exposer le problème à l'utilisateur
    }

    return NextResponse.json({
      success: true,
      message: 'Si cet e-mail existe, un lien de réinitialisation a été envoyé.'
    })
  } catch (error: any) {
    console.error('[ForgotPassword] Unhandled error:', error)
    return NextResponse.json({
      error: 'Erreur serveur.'
    }, { status: 500 })
  }
}
