import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { verifyAuth } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    const caller = await verifyAuth(request)
    if (!caller) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, sessionId } = body

    if (!userId || userId !== caller.uid) {
      return NextResponse.json({ error: 'Action non autorisée.' }, { status: 403 })
    }

    const db = getAdminFirestore()
    const now = new Date().toISOString()
    const updates: Record<string, any> = {
      lastActiveAt: now
    }
    if (sessionId) updates.lastSessionId = sessionId

    await db.collection('users').doc(userId).update(updates)

    return NextResponse.json({ success: true, timestamp: now })
  } catch (error: any) {
    console.error('[Presence] heartbeat error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 })
  }
}
