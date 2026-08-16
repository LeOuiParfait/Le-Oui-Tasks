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
    const { record, presence } = body

    if (!record || record.userId !== caller.uid) {
      return NextResponse.json({ error: 'Vous ne pouvez modifier que votre propre pointage.' }, { status: 403 })
    }

    const db = getAdminFirestore()
    await db.collection('attendance').doc(record.id).set(record, { merge: true })
    await db.collection('users').doc(record.userId).update({
      presenceStatus: presence || record.status,
      lastActiveAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true, record })
  } catch (error: any) {
    console.error('[Attendance] toggle-break error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 })
  }
}
