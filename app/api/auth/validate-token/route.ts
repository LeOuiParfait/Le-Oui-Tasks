import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token manquant.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    const resetDoc = await db.collection('passwordResets').doc(token).get()

    if (!resetDoc.exists) {
      return NextResponse.json({ valid: false, error: 'Lien invalide ou inexistant.' }, { status: 400 })
    }

    const data = resetDoc.data()!

    if (data.used) {
      return NextResponse.json({ valid: false, error: 'Ce lien a déjà été utilisé.' }, { status: 400 })
    }

    if (new Date(data.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Ce lien a expiré. Veuillez demander un nouveau lien.' }, { status: 400 })
    }

    return NextResponse.json({ valid: true, email: data.email })
  } catch (error: any) {
    console.error('[Auth] Error in validate-token:', error)
    return NextResponse.json({ valid: false, error: error.message || 'Erreur serveur.' }, { status: 500 })
  }
}
