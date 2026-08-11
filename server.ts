import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { initializeApp as adminInitApp, cert as adminCert } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';
import { getStorage as adminGetStorage } from 'firebase-admin/storage';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

// Augment Express Request with multer's file property
declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File;
  }
}

dotenv.config({ path: '.env.local' });

// --- Firebase Admin SDK (server-side, bypasses CORS & security rules) ---
let adminApp: any = null;
let adminAuth: any = null;
let adminFirestore: any = null;
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
  adminAuth = adminGetAuth(adminApp);
  adminFirestore = adminGetFirestore(adminApp);
  adminStorage = adminGetStorage();
  return adminApp;
}

function getAdminAuth() {
  if (adminAuth) return adminAuth;
  getAdminApp();
  return adminAuth;
}

function getAdminFirestore() {
  if (adminFirestore) return adminFirestore;
  getAdminApp();
  return adminFirestore;
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

  // --- Auth: Generate custom password reset token (100% independent of Firebase UI) ---
  app.post('/api/auth/reset-link', async (req, res) => {
    try {
      const { email, firstName, appName, userId } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email requis.' });
      }

      const auth = getAdminAuth();
      const db = getAdminFirestore();
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

      // Resolve Firebase UID for this email if not provided
      let uid: string = userId;
      if (!uid) {
        try {
          const userRecord = await auth.getUserByEmail(email);
          uid = userRecord.uid;
        } catch {
          return res.status(404).json({ error: 'Aucun utilisateur trouvé avec cet e-mail.' });
        }
      }

      // Generate custom token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.collection('passwordResets').doc(token).set({
        userId: uid,
        email,
        used: false,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      const link = `${appUrl}/reset-password?token=${token}`;

      // Send custom email via SMTP (Gmail) if configured
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const fromEmail = process.env.FROM_EMAIL || smtpUser;

      let emailSent = false;
      let emailId: string | null = null;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });

          const info = await transporter.sendMail({
            from: `"Le Oui Parfait" <${fromEmail}>`,
            to: email,
            subject: `${appName || 'Le Oui Parfait'} — Activez votre compte`,
            html: `
              <!DOCTYPE html>
              <html lang="fr">
                <body style="margin:0;padding:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;">
                  <table width="100%" style="background:#f5f5f4;padding:40px 20px;">
                    <tr><td align="center">
                      <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.08);max-width:600px;width:100%;">
                        <tr>
                          <td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:40px;text-align:center;">
                            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">${appName || 'Le Oui Parfait'}</h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:40px;">
                            <p style="font-size:16px;color:#44403c;margin:0 0 16px;">Bonjour ${firstName || ''},</p>
                            <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0 0 24px;">
                              Votre compte a été créé. Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace de travail.
                            </p>
                            <p style="text-align:center;margin:0 0 32px;">
                              <a href="${link}" style="background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;">
                                Définir mon mot de passe
                              </a>
                            </p>
                            <p style="font-size:13px;color:#78716c;margin:0 0 12px;">
                              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
                            </p>
                            <p style="margin:0;word-break:break-all;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:8px;padding:12px;font-size:13px;">
                              <a href="${link}" style="color:#0f766e;">${link}</a>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
              </html>
            `
          });

          emailSent = true;
          emailId = info.messageId || null;
          console.log(`[SMTP] Invitation email sent to ${email}: ${info.messageId}`);
        } catch (emailErr: any) {
          console.warn('[SMTP] Failed to send invitation email:', emailErr.message);
        }
      }

      res.json({ success: true, link, emailSent, emailId });
    } catch (error: any) {
      console.error('[Auth] Error generating reset token:', error);
      res.status(500).json({ error: error.message || 'Erreur lors de la génération du token.' });
    }
  });

  // --- Auth: Validate custom reset token ---
  app.get('/api/auth/validate-token', async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token requis.' });
      }

      const db = getAdminFirestore();
      const tokenDoc = await db.collection('passwordResets').doc(token).get();

      if (!tokenDoc.exists) {
        return res.status(400).json({ error: 'Lien invalide.' });
      }

      const data = tokenDoc.data()!;
      if (data.used) {
        return res.status(400).json({ error: 'Ce lien a déjà été utilisé.' });
      }
      if (new Date(data.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Ce lien a expiré.' });
      }

      res.json({ success: true, email: data.email, userId: data.userId });
    } catch (error: any) {
      console.error('[Auth] Error validating token:', error);
      res.status(500).json({ error: error.message || 'Erreur de validation.' });
    }
  });
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token et mot de passe requis.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
      }

      const db = getAdminFirestore();
      const auth = getAdminAuth();

      const tokenRef = db.collection('passwordResets').doc(token);
      const tokenDoc = await tokenRef.get();

      if (!tokenDoc.exists) {
        return res.status(400).json({ error: 'Lien invalide.' });
      }

      const data = tokenDoc.data()!;
      if (data.used) {
        return res.status(400).json({ error: 'Ce lien a déjà été utilisé.' });
      }
      if (new Date(data.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Ce lien a expiré.' });
      }

      // Update Firebase user password directly
      await auth.updateUser(data.userId, { password: newPassword });

      // Mark token as used
      await tokenRef.update({ used: true, usedAt: new Date().toISOString() });

      res.json({ success: true, message: 'Mot de passe mis à jour.' });
    } catch (error: any) {
      console.error('[Auth] Error resetting password:', error);
      res.status(500).json({ error: error.message || 'Erreur lors de la réinitialisation.' });
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

    // SPA fallback: for client-side routes like /reset-password, serve index.html
    const indexPath = path.join(process.cwd(), 'index.html');
    app.get('*', async (req, res, next) => {
      // Skip API routes
      if (req.url.startsWith('/api/')) return next();
      // Skip static assets handled by Vite
      if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|eot|otf)$/)) return next();
      try {
        const rawHtml = fs.readFileSync(indexPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.url, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
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
