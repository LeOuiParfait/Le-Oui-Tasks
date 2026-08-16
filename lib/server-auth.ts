import { NextRequest } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'

export async function verifyAuth(request: NextRequest): Promise<{ uid: string; email?: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.substring(7).trim()
  if (!token) return null

  try {
    const auth = getAdminAuth()
    const decoded = await auth.verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email }
  } catch (err) {
    console.error('[ServerAuth] Token verification failed:', err)
    return null
  }
}
