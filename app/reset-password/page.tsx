'use client'

import { Suspense } from 'react'
import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage'
import { Loader2 } from 'lucide-react'

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-sm text-stone-500 font-medium">Chargement...</p>
      </div>
    </div>
  )
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordPage />
    </Suspense>
  )
}
