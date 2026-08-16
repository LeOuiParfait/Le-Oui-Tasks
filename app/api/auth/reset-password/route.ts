import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Token et nouveau mot de passe requis.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    const resetDoc = await db.collection('passwordResets').doc(token).get()

    if (!resetDoc.exists) {
      return NextResponse.json({ error: 'Token invalide ou expiré.' }, { status: 400 })
    }

    const data = resetDoc.data()!

    if (data.used) {
      return NextResponse.json({ error: 'Ce lien a déjà été utilisé.' }, { status: 400 })
    }

    if (new Date(data.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Ce lien a expiré. Veuillez demander un nouveau lien.' }, { status: 400 })
    }

    const auth = getAdminAuth()
    await auth.updateUser(data.userId, {
      password,
      emailVerified: true
    })

    const now = new Date().toISOString()
    await db.collection('passwordResets').doc(token).update({
      used: true,
      usedAt: now
    })

    await db.collection('users').doc(data.userId).update({
      updatedAt: now
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès.'
    })
  } catch (error: any) {
    console.error('[Auth] Error in reset-password:', error)
    return NextResponse.json({
      error: error.message || 'Erreur lors de la réinitialisation du mot de passe.'
    }, { status: 500 })
  }
}
