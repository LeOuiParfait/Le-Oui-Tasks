import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, status, sessionId, idToken } = body

    if (!userId || !idToken) {
      return NextResponse.json({ error: 'userId et idToken requis.' }, { status: 400 })
    }

    let decodedUid: string
    try {
      const auth = getAdminAuth()
      const decoded = await auth.verifyIdToken(idToken)
      decodedUid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Token invalide.' }, { status: 401 })
    }

    if (userId !== decodedUid) {
      return NextResponse.json({ error: 'Interdit.' }, { status: 403 })
    }

    const db = getAdminFirestore()
    const updates: Record<string, any> = {
      presenceStatus: status || 'away',
      lastActiveAt: new Date().toISOString()
    }
    if (sessionId) updates.lastSessionId = sessionId

    await db.collection('users').doc(userId).update(updates)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Presence] away error:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
