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

    const db = getAdminFirestore()
    const callerDoc = await db.collection('users').doc(caller.uid).get()
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 })
    }

    const callerData = callerDoc.data()!
    if (callerData.role !== 'super_admin' && callerData.role !== 'admin') {
      return NextResponse.json({ error: 'Seuls les administrateurs peuvent inviter de nouveaux membres.' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, firstName, lastName, role, jobTitle, avatar, orgId } = body

    if (!email || !firstName || !lastName || !role || !orgId) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 })
    }

    const auth = getAdminAuth()
    let userRecord
    try {
      userRecord = await auth.createUser({
        email,
        password: password || crypto.randomUUID(),
        displayName: `${firstName} ${lastName}`,
        emailVerified: false
      })
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'Un compte avec cet e-mail existe déjà.' }, { status: 400 })
      }
      throw err
    }

    const now = new Date().toISOString()
    const userData = {
      id: userRecord.uid,
      organizationId: orgId,
      firstName,
      lastName,
      email,
      avatar: avatar || '',
      role,
      teamIds: [],
      jobTitle: jobTitle || '',
      presenceStatus: 'offline',
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now
    }

    await db.collection('users').doc(userRecord.uid).set(userData)

    // Generate activation link and send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://tasks.leouiparfait.com'
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours pour un nouveau membre

    await db.collection('passwordResets').doc(token).set({
      userId: userRecord.uid,
      email,
      used: false,
      createdAt: now,
      expiresAt: expiresAt.toISOString()
    })

    const link = `${appUrl}/reset-password?flow=activate#token=${token}`

    try {
      await sendEmail(
        email,
        'Bienvenue sur LE LOUI PARFAIT - Activez votre compte',
        `Bonjour ${firstName},\n\nVotre compte a été créé avec succès avec le rôle "${role}". Cliquez sur le lien ci-dessous pour configurer votre mot de passe et accéder à votre espace de travail.`,
        link,
        'Activer mon compte'
      )
    } catch (mailErr: any) {
      console.warn('[Auth] Activation email failed:', mailErr.message)
    }

    return NextResponse.json({
      success: true,
      userId: userRecord.uid
    })
  } catch (error: any) {
    console.error('[Auth] Error in create-member:', error)
    return NextResponse.json({
      error: error.message || 'Erreur lors de la création du membre.'
    }, { status: 500 })
  }
}
