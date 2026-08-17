import { initializeApp, cert, getApps, App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

let adminApp: App | null = null

function formatPrivateKey(key: string | undefined): string | null {
  if (!key) return null
  let formatted = key.replace(/\\n/g, '\n').trim()
  if ((formatted.startsWith('"') && formatted.endsWith('"')) ||
      (formatted.startsWith("'") && formatted.endsWith("'"))) {
    formatted = formatted.slice(1, -1)
  }
  if (!formatted.includes('-----BEGIN PRIVATE KEY-----')) {
    return null
  }
  return formatted
}

export function getAdminApp() {
  if (adminApp) return adminApp

  // Check if already initialized
  const apps = getApps()
  if (apps.length > 0) {
    adminApp = apps[0]
    return adminApp
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY
  const privateKey = formatPrivateKey(rawPrivateKey)
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL

  const missing: string[] = []
  if (!projectId) missing.push('FIREBASE_PROJECT_ID')
  if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY (absente ou malformée)')
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL')

  if (missing.length > 0) {
    const msg = `Firebase Admin SDK credentials missing: ${missing.join(', ')}`
    console.error('[FirebaseAdmin]', msg)
    throw new Error(msg)
  }

  try {
    adminApp = initializeApp({
      credential: cert({ projectId, privateKey, clientEmail }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    })
  } catch (err: any) {
    console.error('[FirebaseAdmin] Failed to initialize:', err.message || err)
    throw err
  }

  return adminApp
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp())
}

export function getAdminStorage() {
  return getStorage(getAdminApp())
}
