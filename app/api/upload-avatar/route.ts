import { NextRequest, NextResponse } from 'next/server'
import { getAdminStorage } from '@/lib/firebase-admin'
import { verifyAuth } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    const caller = await verifyAuth(request)
    if (!caller) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null
    const userId = formData.get('userId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 })
    }

    if (!userId || userId !== caller.uid) {
      return NextResponse.json({ error: 'Vous ne pouvez uploader que votre propre avatar.' }, { status: 403 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Try Firebase Storage first
    try {
      const storage = getAdminStorage()
      const bucket = storage.bucket()
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `avatars/${userId}/${Date.now()}-${safeName}`
      const storageFile = bucket.file(fileName)

      await storageFile.save(buffer, {
        metadata: { contentType: file.type || 'image/jpeg' }
      })
      await storageFile.makePublic()

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`
      return NextResponse.json({ url: publicUrl })
    } catch (storageErr: any) {
      console.warn('[Storage] Upload Firebase Storage échec, fallback base64:', storageErr.message)
    }

    // Fallback: Data URL
    const maxSize = 800 * 1024 // 800KB
    if (buffer.length > maxSize) {
      return NextResponse.json({
        error: 'L\'image est trop volumineuse pour le stockage fallback (max 800 Ko).'
      }, { status: 400 })
    }

    const dataUrl = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`
    return NextResponse.json({ url: dataUrl })
  } catch (error: any) {
    console.error('[Storage] Erreur upload avatar:', error)
    return NextResponse.json({ error: error.message || 'Échec de l\'upload.' }, { status: 500 })
  }
}
