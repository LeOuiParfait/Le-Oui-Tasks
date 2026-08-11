import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { initializeApp as adminInitApp, cert as adminCert } from 'firebase-admin/app';
import { getStorage as adminGetStorage } from 'firebase-admin/storage';

// Augment Express Request with multer's file property
declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File;
  }
}

dotenv.config({ path: '.env.local' });

// --- Firebase Admin SDK (server-side, bypasses CORS & security rules) ---
let adminApp: any = null;
let adminStorage: any = null;

function getAdminApp() {
  if (adminApp) return adminApp;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Firebase Admin SDK credentials missing in .env.local');
  }

  adminApp = adminInitApp({
    credential: adminCert({ projectId, privateKey, clientEmail }),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET
  });
  adminStorage = adminGetStorage();
  return adminApp;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Multer for file uploads (in-memory)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
  });

  // --- Health Check ---
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Le Oui Parfait Platform API'
    });
  });

  // --- Avatar Upload (server-side via Admin SDK, bypasses CORS) ---
  app.post('/api/upload-avatar', upload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni.' });
      }

      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ error: 'userId manquant.' });
      }

      // Try Firebase Storage first
      try {
        getAdminApp();
        const bucket = adminStorage.bucket();
        const fileName = `avatars/${userId}/${Date.now()}-${req.file.originalname}`;
        const file = bucket.file(fileName);

        await file.save(req.file.buffer, {
          metadata: { contentType: req.file.mimetype }
        });
        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        console.log(`[Storage] Avatar uploaded for user ${userId}: ${publicUrl}`);
        return res.json({ url: publicUrl });
      } catch (storageErr: any) {
        // Fallback: return base64 data URL (stored directly in Firestore)
        console.warn('[Storage] Upload échec, fallback base64:', storageErr.message);
      }

      // Convert to base64 data URL — resize by limiting to 200x200 via sharp-less approach
      // For simplicity, just encode as data URL (Firestore doc limit is 1MB)
      const maxSize = 800 * 1024; // 800KB limit for base64 in Firestore
      let buffer = req.file.buffer;

      if (buffer.length > maxSize) {
        return res.status(400).json({
          error: 'L\'image est trop volumineuse pour le stockage fallback. Activez Firebase Storage dans la console ou utilisez une image < 800 Ko.'
        });
      }

      const dataUrl = `data:${req.file.mimetype};base64,${buffer.toString('base64')}`;
      console.log(`[Storage] Avatar stocké en base64 pour user ${userId} (${Math.round(buffer.length / 1024)} Ko)`);
      res.json({ url: dataUrl });
    } catch (error: any) {
      console.error('[Storage] Erreur upload avatar:', error);
      res.status(500).json({ error: error.message || 'Échec de l\'upload.' });
    }
  });

  // --- Report Email Dispatch ---
  app.post('/api/reports/send', async (req, res) => {
    try {
      const { reportId, recipients, reportData } = req.body;
      const resendApiKey = process.env.RESEND_API_KEY;

      console.log(`[Email Service] Dispatching report ${reportId} to: ${recipients.join(', ')}`);

      if (resendApiKey) {
        // Real transactional email via Resend API
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: process.env.FROM_EMAIL || 'reports@tasking.app',
            to: recipients,
            subject: `Rapport d'Avancement Quotidien - ${reportData?.date || new Date().toISOString().split('T')[0]}`,
            html: `
              <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
                <h1 style="color: #2563eb; margin-bottom: 8px;">Rapport Quotidien d'Équipe Le Oui Parfait</h1>
                <p style="color: #64748b;">Généré pour : <strong>${reportData?.generatedBy || "Équipe d'Ingénierie"}</strong></p>
                <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
                
                <h3>📊 Points Clés de la Journée</h3>
                <ul>
                  <li><strong>Présence :</strong> ${reportData?.attendanceSummary?.present || 5} présents / ${reportData?.attendanceSummary?.expected || 5} attendus</li>
                  <li><strong>Tâches Terminées :</strong> ${reportData?.tasksSummary?.completed || 0}</li>
                  <li><strong>Tâches En Cours :</strong> ${reportData?.tasksSummary?.inProgress || 0}</li>
                  <li><strong>Tâches Bloquées :</strong> ${reportData?.tasksSummary?.blocked || 0}</li>
                </ul>

                ${
                  reportData?.blockers?.length > 0
                    ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0;">
                        <h4 style="color: #991b1b; margin: 0 0 8px 0;">🚨 Blocages Critiques</h4>
                        <ul>
                          ${reportData.blockers.map((b: any) => `<li><strong>${b.taskTitle}</strong> (${b.assigneeName}) : ${b.reason}</li>`).join('')}
                        </ul>
                      </div>`
                    : '<p>✅ Aucun blocage actif signalé aujourd\'hui.</p>'
                }

                <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Ouvrir le Tableau de Bord</a>
              </div>
            `
          })
        });

        const resData = await response.json();
        return res.json({ success: true, message: 'E-mail envoyé via Resend', id: resData.id });
      }

      // Simulated transaction fallback with response
      return res.json({
        success: true,
        simulated: true,
        message: `Rapport ${reportId} généré avec succès et mis en file d'attente pour ${recipients.length} destinataires (${recipients.join(', ')}). Configurez RESEND_API_KEY dans le fichier .env pour une livraison réelle.`,
        sentAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi du rapport par e-mail:', error);
      res.status(500).json({ error: error.message || 'Échec de l\'envoi du rapport' });
    }
  });

  // --- Vite Dev Server Middleware vs Production Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Le Oui Parfait Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
