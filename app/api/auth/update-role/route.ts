import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { verifyAuth } from '@/lib/server-auth'
import { UserRole } from '@/types'

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'admin', 'manager', 'team_lead', 'user', 'viewer']

export async function POST(request: NextRequest) {
  try {
    const caller = await verifyAuth(request)
    if (!caller) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const body = await request.json()
    const { targetUserId, newRole } = body

    if (!targetUserId || !newRole) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })
    }

    if (!ALLOWED_ROLES.includes(newRole)) {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    const callerDoc = await db.collection('users').doc(caller.uid).get()
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 })
    }

    const callerData = callerDoc.data()!
    if (callerData.role !== 'super_admin' && callerData.role !== 'admin') {
      return NextResponse.json({ error: 'Seuls les administrateurs peuvent modifier les rôles.' }, { status: 403 })
    }

    // Un admin non-super_admin ne peut pas créer/promouvoir un super_admin
    if (newRole === 'super_admin' && callerData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Seul un Super Admin peut attribuer le rôle Super Admin.' }, { status: 403 })
    }

    await db.collection('users').doc(targetUserId).update({
      role: newRole,
      updatedAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Auth] Error in update-role:', error)
    return NextResponse.json({
      error: error.message || 'Erreur lors de la mise à jour du rôle.'
    }, { status: 500 })
  }
}
