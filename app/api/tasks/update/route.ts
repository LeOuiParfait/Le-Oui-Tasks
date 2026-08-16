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
    const { taskId, updates } = body

    if (!taskId || !updates) {
      return NextResponse.json({ error: 'taskId et updates requis.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    await db.collection('tasks').doc(taskId).set({
      ...updates,
      updatedAt: new Date().toISOString()
    }, { merge: true })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Tasks] update error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 })
  }
}
