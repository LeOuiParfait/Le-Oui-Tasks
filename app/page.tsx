'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/services/AuthContext'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { Workspace } from '@/components/workspace/Workspace'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const { firebaseUid, currentUser, initializing } = useAuth()
  const router = useRouter()

  // Show loading state
  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Chargement de votre espace...</p>
        </div>
      </div>
    )
  }

  // Show auth screen if not logged in
  if (!firebaseUid || !currentUser) {
    return <AuthScreen />
  }

  // Show workspace if logged in
  return <Workspace />
}
