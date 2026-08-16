import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { initializeApp as adminInitApp, cert as adminCert } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';
import { getStorage as adminGetStorage } from 'firebase-admin/storage';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Augment Express Request with multer's file property (déplacé plus bas avec authUser)

dotenv.config({ path: '.env.local' });

// Fallback pour Vercel : si les variables URL ne sont pas définies, utiliser le domaine de prod
if (!process.env.APP_URL) {
  process.env.APP_URL = 'https://tasks.leouiparfait.com';
}
if (!process.env.APP_BASE_URL) {
  process.env.APP_BASE_URL = process.env.APP_URL;
}

// --- Branding pour e-mails ---
const APP_BASE_URL = (process.env.APP_BASE_URL || process.env.APP_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
const LOGO_URL = APP_BASE_URL ? `${APP_BASE_URL}/logo-horizontal.png` : '';

// Port utilisé localement et dans les fallbacks
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

function emailLogoHtml(appName?: string): string {
  if (LOGO_URL) {
    return `<img src="${LOGO_URL}" alt="${escapeHtml(appName || 'LE LOUI PARFAIT')}" style="height:40px;width:auto;display:inline-block;" />`;
  }
  return `<h1 style="margin:0;color:#1c1917;font-size:22px;font-weight:600;letter-spacing:-0.02em;font-family:'Inter',Arial,Helvetica,sans-serif;">${escapeHtml(appName || 'LE LOUI PARFAIT')}</h1>`;
}

// Template email unifie : entete blanche, contenu sobre, pas d'emoji ni d'alertes colorees
function emailLayoutHtml(title: string, body: string, action?: { label: string; href: string }, footer?: string): string {
  const appName = 'LE LOUI PARFAIT';
  const actionHtml = action
    ? `<p style="text-align:center;margin:32px 0 0;">
         <a href="${action.href}" style="background:#887D93;color:#fff;padding:14px 32px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:14px;">${escapeHtml(action.label)}</a>
       </p>`
    : '';
  const footerHtml = footer
    ? `<tr>
         <td style="padding:24px 32px;background:#fff;border-top:1px solid #f0efef;text-align:center;">
           <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.5;">${footer}</p>
         </td>
       </tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f5f7;font-family:'Inter',Arial,Helvetica,sans-serif;color:#44403c;">
    <table width="100%" style="background:#f6f5f7;padding:32px 16px;">
      <tr><td align="center">
        <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 32px 24px;background:#fff;text-align:left;border-bottom:1px solid #f0efef;">
              ${emailLogoHtml(appName)}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;color:#1c1917;font-size:20px;font-weight:600;line-height:1.3;">${escapeHtml(title)}</h1>
              ${body}
              ${actionHtml}
            </td>
          </tr>
          ${footerHtml}
          <tr>
            <td style="padding:20px 32px;background:#fafaf9;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a8a29e;">© ${new Date().getFullYear()} ${appName}. Tous droits réservés.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

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

// --- Types étendus pour l'auth ---
declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File;
    authUser?: { uid: string; email?: string };
  }
}

// --- Rate limiters via express-rate-limit ---
// Pour du multi-instance à grande échelle, remplace le MemoryStore par Redis
// via `rate-limit-redis` (store: new RedisStore({ sendCommand: redis.sendCommand })).

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requêtes/min par IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Trop de requêtes. Réessayez dans 1 minute.' });
  }
});

const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,             // 10 requêtes/min par IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Trop de requêtes sur cet endpoint. Réessayez plus tard.' });
  }
});

// --- Middleware : Authentification Firebase (vérifie le token ID) ---
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification manquant.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    req.authUser = { uid: decodedToken.uid, email: decodedToken.email };
    next();
  } catch (error: any) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

// --- Middleware : Vérifier que le userId du body correspond au token ---
function validateUserId(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  const bodyUserId = req.body.userId;
  if (bodyUserId && bodyUserId !== req.authUser.uid) {
    return res.status(403).json({ error: 'Vous ne pouvez agir que sur votre propre compte.' });
  }
  next();
}

// --- Helper : échapper le HTML pour empêcher l'injection dans les emails ---
function escapeHtml(text: unknown): string {
  if (text == null) return '';
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Helper : valider le type de fichier par magic bytes ---
function validateImageFile(buffer: Buffer, mimetype: string): boolean {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedMimes.includes(mimetype)) return false;
  // Vérification des magic bytes
  if (buffer.length < 4) return false;
  // JPEG: FF D8
  if (mimetype === 'image/jpeg' && buffer[0] === 0xFF && buffer[1] === 0xD8) return true;
  // PNG: 89 50 4E 47
  if (mimetype === 'image/png' && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (mimetype === 'image/gif' && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (mimetype === 'image/webp' && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  return false;
}

// --- Helper : sanitiser un nom de fichier (empêcher path traversal) ---
function sanitizeFilename(filename: string): string {
  // Supprimer tout ce qui n'est pas alphanumérique, point, tiret, underscore
  const sanitized = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  // Limiter la longueur
  return sanitized.substring(0, 100);
}

export async function buildApp() {
  const app = express();

  // SÉCURITÉ : Trust proxy (pour rate limiting correct derrière un proxy)
  app.set('trust proxy', 1);

  // SÉCURITÉ : Headers de sécurité (helmet)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"], // Vite nécessite unsafe-inline/eval en dev
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        fontSrc: ["'self'", "data:", "https:", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://www.googleapis.com", "https://firestore.googleapis.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "wss:", "ws://localhost:24678"],
        workerSrc: ["'self'", "blob:"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Firebase nécessite cross-origin
    crossOriginResourcePolicy: { policy: 'cross-origin' } // Firebase Storage nécessite cross-origin
  }));

  // SÉCURITÉ : CORS — restreindre aux origines autorisées
  const allowedOrigins = [
    process.env.APP_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ].filter(Boolean) as string[];
  app.use(cors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origin (curl, Postman, sendBeacon)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Non autorisé par CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use('/api', apiRateLimit); // Rate limit uniquement sur les appels API

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
      service: 'LE LOUI PARFAIT Platform API'
    });
  });

  // --- Avatar Upload (server-side via Admin SDK, bypasses CORS) ---
  app.post('/api/upload-avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni.' });
      }

      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ error: 'userId manquant.' });
      }
      // Validation : le userId doit correspondre au token
      if (userId !== req.authUser?.uid) {
        return res.status(403).json({ error: 'Vous ne pouvez uploader que votre propre avatar.' });
      }

      // SÉCURITÉ : Valider le type de fichier par magic bytes
      if (!validateImageFile(req.file.buffer, req.file.mimetype)) {
        return res.status(400).json({ error: 'Type de fichier invalide. Formats acceptés : JPEG, PNG, GIF, WebP.' });
      }

      // Try Firebase Storage first
      try {
        getAdminApp();
        const bucket = adminStorage.bucket();
        // SÉCURITÉ : Sanitiser le nom de fichier pour empêcher le path traversal
        const safeName = sanitizeFilename(req.file.originalname);
        const fileName = `avatars/${userId}/${Date.now()}-${safeName}`;
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
  // Endpoint admin : nécessite auth + rôle admin/super_admin
  app.post('/api/auth/reset-link', requireAuth, strictRateLimit, async (req, res) => {
    try {
      const { email, firstName, appName, userId } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email requis.' });
      }

      // Vérifier que l'appelant est admin ou super_admin
      const db = getAdminFirestore();
      const callerDoc = await db.collection('users').doc(req.authUser!.uid).get();
      if (!callerDoc.exists) {
        return res.status(403).json({ error: 'Profil introuvable.' });
      }
      const callerData = callerDoc.data()!;
      if (callerData.role !== 'super_admin' && callerData.role !== 'admin') {
        return res.status(403).json({ error: 'Seuls les administrateurs peuvent générer des liens d\'activation.' });
      }

      const auth = getAdminAuth();
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

      // Resolve Firebase UID for this email if not provided
      let uid: string = userId;
      if (!uid) {
        try {
          const userRecord = await auth.getUserByEmail(email);
          uid = userRecord.uid;
        } catch {
          // SÉCURITÉ : Message générique pour éviter l'énumération d'utilisateurs
          return res.status(200).json({ success: true, message: 'Si cet e-mail existe, un lien d\'activation a été envoyé.' });
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

      const link = `${appUrl}/reset-password#token=${token}`;

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
            from: `"LE LOUI PARFAIT" <${fromEmail}>`,
            to: email,
            subject: `${appName || 'LE LOUI PARFAIT'} — Activez votre compte`,
            html: `
              <!DOCTYPE html>
              <html lang="fr">
                <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
                  <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
                    <tr><td align="center">
                      <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
                        <tr>
                          <td style="background:#fff;padding:40px;text-align:center;border-bottom:1px solid #f0efef;">
                            ${emailLogoHtml(appName)}
                            <p style="margin:8px 0 0;color:#78716c;font-size:13px;font-weight:400;">Espace de travail collaboratif</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:40px;">
                            <p style="font-size:16px;color:#1c1917;margin:0 0 16px;font-weight:600;">Bonjour ${escapeHtml(firstName || '')},</p>
                            <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0 0 24px;">
                              Votre compte a été créé sur la plateforme. Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace de travail.
                            </p>
                            <p style="text-align:center;margin:0 0 32px;">
                              <a href="${link}" style="background:#887D93;color:#fff;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:15px;">
                                Définir mon mot de passe
                              </a>
                            </p>
                            <p style="font-size:13px;color:#a8a29e;margin:0 0 12px;">
                              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
                            </p>
                            <p style="margin:0;word-break:break-all;background:#f5f3f6;border:1px solid #ebe7ee;border-radius:8px;padding:12px;font-size:13px;">
                              <a href="${link}" style="color:#6b5f78;">${link}</a>
                            </p>
                            <div style="margin-top:32px;padding-top:24px;border-top:1px solid #ebe7ee;">
                              <p style="font-size:12px;color:#a8a29e;margin:0;line-height:1.6;">
                                Ce lien est valable 1 heure. Si vous n'avez pas demandé cette activation, ignorez cet e-mail.<br/>
                                © ${new Date().getFullYear()} LE LOUI PARFAIT. Tous droits réservés.
                              </p>
                            </div>
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

  // --- Auth: Forgot password (public, rate-limited) ---
  app.post('/api/auth/forgot-password', strictRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email requis.' });
      }

      const auth = getAdminAuth();
      const db = getAdminFirestore();

      // Resolve Firebase UID for this email
      let uid: string | null = null;
      try {
        const userRecord = await auth.getUserByEmail(email);
        uid = userRecord.uid;
      } catch {
        // SÉCURITÉ : Message générique pour éviter l'énumération d'utilisateurs
        return res.status(200).json({ success: true, message: 'Si cet e-mail existe, un lien de réinitialisation a été envoyé.' });
      }

      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.collection('passwordResets').doc(token).set({
        userId: uid,
        email,
        used: false,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      const link = `${appUrl}/reset-password#token=${token}`;

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const fromEmail = process.env.FROM_EMAIL || smtpUser;

      let emailSent = false;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass }
          });

          await transporter.sendMail({
            from: `"LE LOUI PARFAIT" <${fromEmail}>`,
            to: email,
            subject: 'LE LOUI PARFAIT — Réinitialisez votre mot de passe',
            html: `
              <!DOCTYPE html>
              <html lang="fr">
                <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
                  <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
                    <tr><td align="center">
                      <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
                        <tr>
                          <td style="background:#fff;padding:40px;text-align:center;border-bottom:1px solid #f0efef;">
                            ${emailLogoHtml()}
                            <p style="margin:8px 0 0;color:#78716c;font-size:13px;font-weight:400;">Espace de travail collaboratif</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:40px;">
                            <p style="font-size:16px;color:#1c1917;margin:0 0 16px;font-weight:600;">Bonjour,</p>
                            <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0 0 24px;">
                              Une demande de réinitialisation de mot de passe a été effectuée pour votre compte. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
                            </p>
                            <p style="text-align:center;margin:0 0 32px;">
                              <a href="${link}" style="background:#887D93;color:#fff;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:15px;">
                                Réinitialiser mon mot de passe
                              </a>
                            </p>
                            <p style="font-size:13px;color:#a8a29e;margin:0 0 12px;">
                              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
                            </p>
                            <p style="margin:0;word-break:break-all;background:#f5f3f6;border:1px solid #ebe7ee;border-radius:8px;padding:12px;font-size:13px;">
                              <a href="${link}" style="color:#6b5f78;">${link}</a>
                            </p>
                            <div style="margin-top:32px;padding-top:24px;border-top:1px solid #ebe7ee;">
                              <p style="font-size:12px;color:#a8a29e;margin:0;line-height:1.6;">
                                Ce lien est valable 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.<br/>
                                © ${new Date().getFullYear()} LE LOUI PARFAIT. Tous droits réservés.
                              </p>
                            </div>
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
          console.log(`[SMTP] Password reset email sent to ${email}`);
        } catch (emailErr: any) {
          console.warn('[SMTP] Failed to send reset email:', emailErr.message);
        }
      }

      res.json({ success: true, link, emailSent });
    } catch (error: any) {
      console.error('[Auth] Error generating forgot-password token:', error);
      res.status(500).json({ error: error.message || 'Erreur lors de la génération du token.' });
    }
  });

  // --- Notifications: Send notification email via SMTP ---
  app.post('/api/notifications/send-email', requireAuth, async (req: Request, res: Response) => {
    try {
      const { toEmail, subject, title, message, link } = req.body;
      if (!toEmail || !subject || !message) {
        return res.status(400).json({ error: 'Destinataire, sujet et message requis.' });
      }

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const fromEmail = process.env.FROM_EMAIL || smtpUser;
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn('[SMTP] Envoi de notification impossible : credentials SMTP manquants.');
        return res.status(200).json({ success: true, sent: false, reason: 'SMTP non configuré.' });
      }

      const actionUrl = link ? (link.startsWith('http') ? link : `${appUrl}${link}`) : appUrl;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });

      await transporter.sendMail({
        from: `"LE LOUI PARFAIT" <${fromEmail}>`,
        to: toEmail,
        subject,
        html: `
          <!DOCTYPE html>
          <html lang="fr">
            <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
              <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
                <tr><td align="center">
                  <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
                    <tr>
                      <td style="background:#fff;padding:40px;text-align:center;border-bottom:1px solid #f0efef;">
                        ${emailLogoHtml()}
                        <p style="margin:8px 0 0;color:#78716c;font-size:13px;font-weight:400;">Espace de travail collaboratif</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <p style="font-size:16px;color:#1c1917;margin:0 0 16px;font-weight:600;">Bonjour,</p>
                        <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0 0 24px;">${escapeHtml(message)}</p>
                        <p style="text-align:center;margin:0 0 32px;">
                          <a href="${actionUrl}" style="background:#887D93;color:#fff;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:15px;">
                            Voir la notification
                          </a>
                        </p>
                        <p style="font-size:13px;color:#a8a29e;margin:0 0 12px;">
                          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
                        </p>
                        <p style="margin:0;word-break:break-all;background:#f5f3f6;border:1px solid #ebe7ee;border-radius:8px;padding:12px;font-size:13px;">
                          <a href="${actionUrl}" style="color:#6b5f78;">${actionUrl}</a>
                        </p>
                        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #ebe7ee;">
                          <p style="font-size:12px;color:#a8a29e;margin:0;line-height:1.6;">
                            Vous recevez cet e-mail car vous avez des notifications activées sur votre espace.<br/>
                            © ${new Date().getFullYear()} LE LOUI PARFAIT. Tous droits réservés.
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
          </html>
        `
      });

      res.json({ success: true, sent: true });
    } catch (error: any) {
      console.error('[Notif] Erreur envoi e-mail:', error);
      res.status(500).json({ error: error.message || 'Erreur lors de l\'envoi de l\'e-mail.' });
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
  // --- Auth: Reset password with token (pas besoin d'auth car c'est un endpoint public avec token) ---
  app.post('/api/auth/reset-password', strictRateLimit, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token et mot de passe requis.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
      }
      // Validation : au moins une majuscule, une minuscule et un chiffre
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.' });
      }

      const db = getAdminFirestore();
      const auth = getAdminAuth();

      const tokenRef = db.collection('passwordResets').doc(token);

      // SÉCURITÉ : Utiliser une transaction pour rendre la validation atomique
      // et empêcher la race condition (réutilisation du token)
      let errorMsg: string | null = null;
      let targetUserId: string | null = null;

      await db.runTransaction(async (transaction: any) => {
        const tokenDoc = await transaction.get(tokenRef);

        if (!tokenDoc.exists) {
          errorMsg = 'Lien invalide.';
          return;
        }

        const data = tokenDoc.data()!;
        if (data.used) {
          errorMsg = 'Ce lien a déjà été utilisé.';
          return;
        }
        if (new Date(data.expiresAt) < new Date()) {
          errorMsg = 'Ce lien a expiré.';
          return;
        }

        // Marquer le token comme utilisé DANS la transaction (atomique)
        transaction.update(tokenRef, { used: true, usedAt: new Date().toISOString() });
        targetUserId = data.userId;
      });

      if (errorMsg) {
        return res.status(400).json({ error: errorMsg });
      }

      // Mettre à jour le mot de passe Firebase après la transaction
      // (la transaction a déjà marqué le token comme utilisé)
      await auth.updateUser(targetUserId!, { password: newPassword });

      res.json({ success: true, message: 'Mot de passe mis à jour.' });
    } catch (error: any) {
      console.error('[Auth] Error resetting password:', error);
      res.status(500).json({ error: error.message || 'Erreur lors de la réinitialisation.' });
    }
  });

  // --- Auth: Create member (admin only) ---
  // SÉCURITÉ : Création d'utilisateur via Admin SDK avec vérification d'autorisation
  app.post('/api/auth/create-member', requireAuth, strictRateLimit, async (req, res) => {
    try {
      const { email, password, firstName, lastName, role, jobTitle, avatar, orgId } = req.body;

      // Validation des champs requis
      if (!email || !password || !firstName || !lastName || !role || !orgId) {
        return res.status(400).json({ error: 'Champs manquants.' });
      }

      // SÉCURITÉ : Vérifier que l'appelant est admin ou super_admin
      const db = getAdminFirestore();
      const callerDoc = await db.collection('users').doc(req.authUser!.uid).get();
      if (!callerDoc.exists) {
        return res.status(403).json({ error: 'Profil introuvable.' });
      }
      const callerData = callerDoc.data()!;
      const callerRole = callerData.role;

      if (callerRole !== 'super_admin' && callerRole !== 'admin' && callerRole !== 'manager') {
        return res.status(403).json({ error: 'Seuls les administrateurs et managers peuvent créer des membres.' });
      }

      // SÉCURITÉ : Vérifier que l'appelant appartient à la même org
      if (callerData.organizationId !== orgId) {
        return res.status(403).json({ error: 'Vous ne pouvez créer des membres que dans votre organisation.' });
      }

      // SÉCURITÉ : Un admin ne peut pas créer de super_admin
      // Un manager ne peut créer que des 'user' ou 'viewer'
      const validRoles = ['super_admin', 'admin', 'manager', 'team_lead', 'user', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Rôle invalide.' });
      }
      if (callerRole === 'admin' && role === 'super_admin') {
        return res.status(403).json({ error: 'Un admin ne peut pas créer un super_admin.' });
      }
      if (callerRole === 'manager' && !['user', 'viewer'].includes(role)) {
        return res.status(403).json({ error: 'Un manager ne peut créer que des utilisateurs ou viewers.' });
      }

      // Validation du mot de passe (policy serveur)
      if (password.length < 8) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.' });
      }

      // Créer l'utilisateur via Firebase Admin SDK
      const auth = getAdminAuth();
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: `${firstName} ${lastName}`
        });
      } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
          return res.status(409).json({ error: 'Un compte avec cet e-mail existe déjà.' });
        }
        throw error;
      }

      // Créer le document Firestore
      const now = new Date().toISOString();
      await db.collection('users').doc(userRecord.uid).set({
        organizationId: orgId,
        firstName,
        lastName,
        email,
        avatar: avatar || '',
        role,
        teamIds: [],
        jobTitle: jobTitle || '',
        presenceStatus: 'offline',
        lastActiveAt: now,
        createdAt: now
      });

      // Envoyer un e-mail d'invitation avec les identifiants
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const fromEmail = process.env.FROM_EMAIL || smtpUser;
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass }
          });
          await transporter.sendMail({
            from: `"LE LOUI PARFAIT" <${fromEmail}>`,
            to: email,
            subject: 'Votre compte LE LOUI PARFAIT a été créé',
            html: `
              <!DOCTYPE html>
              <html lang="fr">
                <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
                  <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
                    <tr><td align="center">
                      <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
                        <tr>
                          <td style="background:#fff;padding:32px 40px;text-align:center;border-bottom:1px solid #f0efef;">
                            ${emailLogoHtml()}
                            <h1 style="margin:12px 0 0;color:#1c1917;font-size:22px;font-weight:600;letter-spacing:-0.01em;font-family:'Inter',Arial,Helvetica,sans-serif;">Bienvenue</h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:32px 40px;">
                            <p style="font-size:14px;color:#57534e;margin:0 0 20px;">
                              Bonjour <strong style="color:#1c1917;">${escapeHtml(firstName)} ${escapeHtml(lastName)}</strong>,<br />
                              Un compte a été créé pour vous sur <strong>LE LOUI PARFAIT</strong>.
                            </p>
                            <div style="background:#f5f3f6;border-radius:10px;padding:16px;margin-bottom:24px;">
                              <p style="margin:0 0 8px;font-weight:600;color:#1c1917;font-size:14px;">Vos identifiants</p>
                              <p style="margin:0 0 4px;font-size:13px;color:#57534e;">E-mail : <strong>${escapeHtml(email)}</strong></p>
                              <p style="margin:0;font-size:13px;color:#57534e;">Mot de passe temporaire : <strong>${escapeHtml(password)}</strong></p>
                            </div>
                            <p style="text-align:center;margin:0 0 8px;">
                              <a href="${appUrl}" style="background:#887D93;color:#fff;padding:14px 32px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:14px;">
                                Se connecter
                              </a>
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:20px 40px;background:#f5f3f6;border-top:1px solid #ebe7ee;">
                            <p style="font-size:11px;color:#a8a29e;margin:0;text-align:center;">
                              © ${new Date().getFullYear()} LE LOUI PARFAIT. Tous droits réservés.
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
          console.log(`[SMTP] Invitation envoyée à ${email}`);
        } catch (emailErr: any) {
          console.warn('[SMTP] Impossible d\'envoyer l\'invitation :', emailErr.message);
        }
      }

      res.status(201).json({
        success: true,
        userId: userRecord.uid,
        message: 'Membre créé avec succès.'
      });
    } catch (error: any) {
      console.error('[Auth] Error creating member:', error);
      res.status(500).json({ error: 'Erreur lors de la création du membre.' });
    }
  });

  // --- Auth: Update user role (admin only) ---
  // SÉCURITÉ : Changement de rôle via Admin SDK avec vérification
  app.post('/api/auth/update-role', requireAuth, strictRateLimit, async (req, res) => {
    try {
      const { targetUserId, newRole } = req.body;

      if (!targetUserId || !newRole) {
        return res.status(400).json({ error: 'targetUserId et newRole requis.' });
      }

      const db = getAdminFirestore();
      const callerDoc = await db.collection('users').doc(req.authUser!.uid).get();
      if (!callerDoc.exists) {
        return res.status(403).json({ error: 'Profil introuvable.' });
      }
      const callerData = callerDoc.data()!;
      const callerRole = callerData.role;

      // SÉCURITÉ : Seuls admin et super_admin peuvent changer les rôles
      if (callerRole !== 'super_admin' && callerRole !== 'admin') {
        return res.status(403).json({ error: 'Seuls les administrateurs peuvent modifier les rôles.' });
      }

      const validRoles = ['super_admin', 'admin', 'manager', 'team_lead', 'user', 'viewer'];
      if (!validRoles.includes(newRole)) {
        return res.status(400).json({ error: 'Rôle invalide.' });
      }

      // SÉCURITÉ : Un admin ne peut pas attribuer super_admin
      if (callerRole === 'admin' && newRole === 'super_admin') {
        return res.status(403).json({ error: 'Un admin ne peut pas attribuer le rôle super_admin.' });
      }

      // SÉCURITÉ : Récupérer le target user et vérifier l'org
      const targetDoc = await db.collection('users').doc(targetUserId).get();
      if (!targetDoc.exists) {
        return res.status(404).json({ error: 'Utilisateur introuvable.' });
      }
      const targetData = targetDoc.data()!;
      if (targetData.organizationId !== callerData.organizationId) {
        return res.status(403).json({ error: 'Vous ne pouvez modifier que les utilisateurs de votre organisation.' });
      }

      // SÉCURITÉ : Un admin ne peut pas modifier un super_admin
      if (callerRole === 'admin' && targetData.role === 'super_admin') {
        return res.status(403).json({ error: 'Un admin ne peut pas modifier un super_admin.' });
      }

      await db.collection('users').doc(targetUserId).update({ role: newRole });

      res.json({ success: true, message: 'Rôle mis à jour.' });
    } catch (error: any) {
      console.error('[Auth] Error updating role:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle.' });
    }
  });

  // --- Report Email Dispatch ---
  app.post('/api/reports/send', requireAuth, strictRateLimit, async (req, res) => {
    try {
      const { reportId, recipients, reportData } = req.body;
      const resendApiKey = process.env.RESEND_API_KEY;

      // Validation des destinataires
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'Destinataires manquants.' });
      }
      // Validation format email
      const invalidEmail = recipients.find((e: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (invalidEmail) {
        return res.status(400).json({ error: `E-mail invalide : ${invalidEmail}` });
      }

      // Vérifier que l'user a le droit d'envoyer des rapports (admin, super_admin, manager, team_lead)
      const db = getAdminFirestore();
      const callerDoc = await db.collection('users').doc(req.authUser!.uid).get();
      if (!callerDoc.exists) {
        return res.status(403).json({ error: 'Profil introuvable.' });
      }
      const callerRole = callerDoc.data()!.role;
      if (!['super_admin', 'admin', 'manager', 'team_lead'].includes(callerRole)) {
        return res.status(403).json({ error: 'Vous n\'avez pas le droit d\'envoyer des rapports.' });
      }

      console.log(`[Email Service] ${req.authUser!.email} dispatching report ${reportId} to: ${recipients.join(', ')}`);

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const fromEmail = process.env.FROM_EMAIL || smtpUser || 'reports@tasking.app';

      const reportHtml = `
        <!DOCTYPE html>
        <html lang="fr">
          <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
            <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
              <tr><td align="center">
                <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
                  <tr>
                    <td style="background:#fff;padding:32px 40px;text-align:center;border-bottom:1px solid #f0efef;">
                      ${emailLogoHtml()}
                      <h1 style="margin:12px 0 0;color:#1c1917;font-size:22px;font-weight:600;letter-spacing:-0.01em;font-family:'Inter',Arial,Helvetica,sans-serif;">Rapport Quotidien</h1>
                      <p style="margin:6px 0 0;color:#78716c;font-size:13px;">${new Date().toISOString().split('T')[0]}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px 40px;">
                      <p style="font-size:14px;color:#57534e;margin:0 0 20px;">
                        Généré par : <strong style="color:#1c1917;">${escapeHtml(reportData?.generatedBy || "Équipe d'Ingénierie")}</strong>
                      </p>

                      <table width="100%" style="border-collapse:separate;border-spacing:8px 0;margin-bottom:24px;">
                        <tr>
                          <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:33%;">
                            <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${reportData?.attendanceSummary?.present || 0}</p>
                            <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Présents</p>
                          </td>
                          <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:33%;">
                            <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${reportData?.tasksSummary?.completed || 0}</p>
                            <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Terminées</p>
                          </td>
                          <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:33%;">
                            <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${reportData?.tasksSummary?.inProgress || 0}</p>
                            <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">En cours</p>
                          </td>
                        </tr>
                      </table>

                      ${
                        reportData?.blockers?.length > 0
                          ? `<div style="background:#fafaf9;border-radius:10px;padding:16px;margin:0 0 24px;">
                              <p style="color:#1c1917;margin:0 0 8px;font-weight:600;font-size:14px;">Blocages critiques</p>
                              <ul style="margin:0;padding-left:20px;color:#57534e;font-size:13px;line-height:1.7;">
                                ${reportData.blockers.map((b: any) => `<li><strong>${escapeHtml(b.taskTitle)}</strong> (${escapeHtml(b.assigneeName)}) : ${escapeHtml(b.reason)}</li>`).join('')}
                              </ul>
                            </div>`
                          : '<div style="background:#fafaf9;border-radius:10px;padding:14px;margin:0 0 24px;"><p style="color:#57534e;margin:0;font-size:13px;">Aucun blocage actif signalé aujourd\'hui.</p></div>'
                      }

                      <div style="background:#fafaf9;border-radius:10px;padding:16px;margin-bottom:24px;">
                        <p style="margin:0 0 10px;font-weight:600;color:#1c1917;font-size:14px;">Priorités du jour</p>
                        <ul style="margin:0;padding-left:20px;color:#57534e;font-size:13px;line-height:1.7;">
                          ${(reportData?.prioritiesTomorrow || ['Aucune priorité urgente']).map((p: string) => `<li>${escapeHtml(p)}</li>`).join('')}
                        </ul>
                      </div>

                      <p style="text-align:center;margin:0 0 8px;">
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="background:#887D93;color:#fff;padding:14px 32px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:14px;">
                          Ouvrir le Tableau de Bord
                        </a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;background:#f5f3f6;border-top:1px solid #ebe7ee;">
                      <p style="font-size:11px;color:#a8a29e;margin:0;text-align:center;">
                        © ${new Date().getFullYear()} LE LOUI PARFAIT. Rapport généré automatiquement.
                      </p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
      `;

      // Envoi via Resend si configuré
      if (resendApiKey) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: fromEmail,
            to: recipients,
            subject: `Rapport d'Avancement Quotidien - ${reportData?.date || new Date().toISOString().split('T')[0]}`,
            html: reportHtml
          })
        });
        const resData = await response.json();
        if (response.ok) {
          return res.json({ success: true, message: 'E-mail envoyé via Resend', id: resData.id });
        }
        const isDomainError = typeof resData?.message === 'string' && resData.message.toLowerCase().includes('not verified');
        if (!isDomainError || !smtpHost || !smtpUser || !smtpPass) {
          return res.status(502).json({ error: resData.message || 'Échec de l\'envoi via Resend' });
        }
        console.warn('[Resend] Domaine non vérifié, basculement SMTP.');
      }

      // Fallback SMTP
      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass }
        });
        const info = await transporter.sendMail({
          from: `"LE LOUI PARFAIT" <${fromEmail}>`,
          to: recipients,
          subject: `Rapport d'Avancement Quotidien - ${reportData?.date || new Date().toISOString().split('T')[0]}`,
          html: reportHtml
        });
        console.log(`[SMTP] Report email sent: ${info.messageId}`);
        return res.json({ success: true, message: 'E-mail envoyé via SMTP', id: info.messageId });
      }

      // Simulated transaction fallback with response
      return res.json({
        success: true,
        simulated: true,
        message: `Rapport ${reportId} généré avec succès et mis en file d'attente pour ${recipients.length} destinataires (${recipients.join(', ')}). Configurez RESEND_API_KEY ou SMTP_HOST/SMTP_USER/SMTP_PASS dans le fichier .env pour une livraison réelle.`,
        sentAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi du rapport par e-mail:', error);
      res.status(500).json({ error: error.message || 'Échec de l\'envoi du rapport' });
    }
  });

  // --- Cron Job : Envoi automatique des rapports quotidiens à 18h00 ---
  // Vérifie toutes les minutes si il est 18h00 un jour ouvrable
  const REPORT_SEND_HOUR = parseInt(process.env.REPORT_SEND_HOUR || '18');
  const REPORT_SEND_MINUTE = parseInt(process.env.REPORT_SEND_MINUTE || '0');
  let lastReportSentDate = '';

  async function autoSendDailyReports() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Éviter les doubles envois
    if (lastReportSentDate === todayStr) return;

    // Jour ouvrable (1-5 = Lun-Ven)
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return; // Dimanche/Samedi

    // Vérifier l'heure
    if (now.getHours() !== REPORT_SEND_HOUR || now.getMinutes() !== REPORT_SEND_MINUTE) return;

    lastReportSentDate = todayStr;
    console.log(`[Cron] Envoi automatique des rapports pour ${todayStr} à ${now.toISOString()}`);

    try {
      const db = getAdminFirestore();
      const resendApiKey = process.env.RESEND_API_KEY;

      // Récupérer toutes les organisations
      const orgsSnapshot = await db.collection('organizations').get();

      for (const orgDoc of orgsSnapshot.docs) {
        const orgData = orgDoc.data();
        const baseRecipients = orgData.reportEmailRecipients || [];

        // Récupérer les présences du jour
        const attendanceSnap = await db.collection('attendance')
          .where('organizationId', '==', orgDoc.id)
          .where('date', '==', todayStr)
          .get();

        const present = attendanceSnap.docs.filter((d: QueryDocumentSnapshot) => {
          const s = d.data().status;
          return s !== 'absent';
        }).length;
        const expected = orgData.expectedMembers || 5;

        // Récupérer les tâches du jour
        const tasksSnap = await db.collection('tasks')
          .where('organizationId', '==', orgDoc.id)
          .get();

        const tasks = tasksSnap.docs.map((d: QueryDocumentSnapshot) => d.data());
        const completed = tasks.filter((t: any) => t.status === 'Completed').length;
        const inProgress = tasks.filter((t: any) => t.status === 'In Progress').length;
        const blocked = tasks.filter((t: any) => t.status === 'Blocked').length;

        const reportData = {
          date: todayStr,
          generatedBy: 'Système automatique',
          attendanceSummary: { expected, present, absent: Math.max(0, expected - present) },
          tasksSummary: { completed, inProgress, blocked, inReview: 0, overdue: 0 },
          blockers: tasks
            .filter((t: any) => t.status === 'Blocked')
            .map((t: any) => ({
              taskTitle: t.title || 'Tâche',
              assigneeName: 'Assigné',
              reason: t.blockerReason || 'En attente'
            })),
          prioritiesTomorrow: ['Aucune priorité urgente']
        };

        let recipients = [...baseRecipients];
        if (orgData.includeAdminsInReports) {
          const usersSnap = await db.collection('users')
            .where('organizationId', '==', orgDoc.id)
            .where('role', 'in', ['admin', 'super_admin'])
            .get();
          const adminEmails = usersSnap.docs
            .map((d: any) => d.data().email)
            .filter((e: any) => e && typeof e === 'string');
          recipients = [...new Set([...recipients, ...adminEmails])];
        }

        if (recipients.length === 0) continue;

        if (resendApiKey) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${resendApiKey}`
              },
              body: JSON.stringify({
                from: process.env.FROM_EMAIL || 'reports@tasking.app',
                to: recipients,
                subject: `Rapport Quotidien Automatique - ${todayStr}`,
                html: emailLayoutHtml(
                  `Rapport Quotidien Automatique - ${todayStr}`,
                  `
                    <p style="font-size:14px;color:#57534e;margin:0 0 20px;">Rapport automatique pour <strong style="color:#1c1917;">${escapeHtml(orgData.name)}</strong> - ${todayStr}</p>
                    <table width="100%" style="border-collapse:separate;border-spacing:8px 0;margin-bottom:24px;">
                      <tr>
                        <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:25%;">
                          <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${present}/${expected}</p>
                          <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Présents</p>
                        </td>
                        <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:25%;">
                          <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${completed}</p>
                          <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Terminées</p>
                        </td>
                        <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:25%;">
                          <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${inProgress}</p>
                          <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">En cours</p>
                        </td>
                        <td style="background:#f6f5f7;border-radius:10px;padding:16px;text-align:center;width:25%;">
                          <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${blocked}</p>
                          <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Bloquées</p>
                        </td>
                      </tr>
                    </table>
                  `,
                  { label: 'Ouvrir le Tableau de Bord', href: process.env.APP_URL || 'http://localhost:3000' },
                  `Rapport généré automatiquement le ${todayStr}.`
                )
              })
            });
            console.log(`[Cron] Rapport envoyé pour l'org ${orgData.name} à ${recipients.length} destinataires`);
          } catch (err) {
            console.error(`[Cron] Erreur envoi rapport pour org ${orgDoc.id}:`, err);
          }
        } else {
          console.log(`[Cron] RESEND_API_KEY non configuré - rapport simulé pour ${orgData.name}`);
        }
      }
    } catch (err) {
      console.error('[Cron] Erreur lors de l\'envoi automatique:', err);
    }
  }

  // Lancer le cron toutes les 60 secondes
  setInterval(autoSendDailyReports, 60 * 1000);
  console.log(`[Cron] Envoi automatique des rapports programmé à ${REPORT_SEND_HOUR}h${REPORT_SEND_MINUTE.toString().padStart(2, '0')} les jours ouvrables`);

  // --- Endpoint : Marquer un user comme away (sendBeacon à la fermeture) ---
  // Note : sendBeacon ne supporte pas les headers Authorization, donc on valide le userId
  // via un token Firebase dans le body (sendBeacon ne supporte pas les headers)
  app.post('/api/presence/away', express.json(), async (req: Request, res: Response) => {
    try {
      const { userId, status, sessionId, idToken } = req.body;
      if (!userId) {
        res.status(400).json({ error: 'userId requis' });
        return;
      }
      // SÉCURITÉ : Authentification via token Firebase dans le body
      // (sendBeacon ne peut pas envoyer de headers Authorization)
      if (!idToken) {
        res.status(401).json({ error: 'Token d\'authentification requis.' });
        return;
      }
      let decodedUid: string;
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken);
        decodedUid = decoded.uid;
      } catch {
        res.status(401).json({ error: 'Token invalide.' });
        return;
      }
      // SÉCURITÉ : Le userId doit correspondre au token
      if (userId !== decodedUid) {
        res.status(403).json({ error: 'Vous ne pouvez modifier que votre propre présence.' });
        return;
      }
      const db = getAdminFirestore();
      const updates: any = {
        presenceStatus: status || 'away',
        lastActiveAt: new Date().toISOString()
      };
      if (sessionId) updates.lastSessionId = sessionId;
      await db.collection('users').doc(userId).update(updates);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  });

  // --- Endpoint : Heartbeat (mise à jour lastActiveAt) ---
  app.post('/api/presence/heartbeat', requireAuth, validateUserId, async (req: Request, res: Response) => {
    try {
      const { userId, sessionId } = req.body;
      if (!userId) {
        res.status(400).json({ error: 'userId requis' });
        return;
      }
      // Validation : userId doit correspondre au token
      if (userId !== req.authUser?.uid) {
        res.status(403).json({ error: 'Vous ne pouvez envoyer un heartbeat que pour vous-même.' });
        return;
      }
      const db = getAdminFirestore();
      const now = new Date().toISOString();
      const updates: any = {
        lastActiveAt: now
      };
      if (sessionId) updates.lastSessionId = sessionId;
      await db.collection('users').doc(userId).update(updates);
      res.status(200).json({ success: true, timestamp: now });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Attendance : Start / End / Toggle Break (serveur, Admin SDK, pour tous les rôles) ---
  app.post('/api/attendance/start', requireAuth, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { record } = req.body;
      if (!record || record.userId !== req.authUser?.uid) {
        return res.status(403).json({ error: 'Vous ne pouvez pointer que pour vous-même.' });
      }
      const db = getAdminFirestore();
      await db.collection('attendance').doc(record.id).set(record, { merge: true });
      await db.collection('users').doc(record.userId).update({ presenceStatus: 'online', lastActiveAt: new Date().toISOString() });
      res.json({ success: true, record });
    } catch (error: any) {
      console.error('[Attendance] start error:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur.' });
    }
  });

  app.post('/api/attendance/end', requireAuth, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { record } = req.body;
      if (!record || record.userId !== req.authUser?.uid) {
        return res.status(403).json({ error: 'Vous ne pouvez pointer que pour vous-même.' });
      }
      const db = getAdminFirestore();
      await db.collection('attendance').doc(record.id).set(record, { merge: true });
      await db.collection('users').doc(record.userId).update({ presenceStatus: 'offline', lastActiveAt: new Date().toISOString() });
      res.json({ success: true, record });
    } catch (error: any) {
      console.error('[Attendance] end error:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur.' });
    }
  });

  app.post('/api/attendance/toggle-break', requireAuth, strictRateLimit, async (req: Request, res: Response) => {
    try {
      const { record, presence } = req.body;
      if (!record || record.userId !== req.authUser?.uid) {
        return res.status(403).json({ error: 'Vous ne pouvez modifier que votre propre pointage.' });
      }
      const db = getAdminFirestore();
      await db.collection('attendance').doc(record.id).set(record, { merge: true });
      await db.collection('users').doc(record.userId).update({ presenceStatus: presence || record.status, lastActiveAt: new Date().toISOString() });
      res.json({ success: true, record });
    } catch (error: any) {
      console.error('[Attendance] toggle-break error:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur.' });
    }
  });

  // --- Tasks : Update via Admin SDK (contourne les règles Firestore) ---
  app.post('/api/tasks/update', requireAuth, async (req: Request, res: Response) => {
    try {
      const { taskId, updates } = req.body;
      if (!taskId) {
        return res.status(400).json({ error: 'taskId requis.' });
      }
      console.log('[Tasks] update request:', taskId, req.authUser?.uid, JSON.stringify(updates).slice(0, 200));
      const db = getAdminFirestore();
      await db.collection('tasks').doc(taskId).set({
        ...updates,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log('[Tasks] update success:', taskId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Tasks] update error:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur.' });
    }
  });

  // --- Cron : Détecter les users "stale" (pas de heartbeat depuis 15 min) ---
  const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
  async function checkStaleUsers() {
    try {
      const db = getAdminFirestore();
      const now = Date.now();
      // Récupérer tous les users "online"
      const onlineSnap = await db.collection('users').where('presenceStatus', '==', 'online').get();
      for (const doc of onlineSnap.docs) {
        const data = doc.data();
        const lastActive = data.lastActiveAt ? new Date(data.lastActiveAt).getTime() : 0;
        if (now - lastActive > STALE_THRESHOLD_MS) {
          // Marquer comme "away" (onglet probablement fermé)
          await doc.ref.update({ presenceStatus: 'away' });
          console.log(`[StaleCheck] User ${doc.id} marqué away (pas de heartbeat depuis ${Math.round((now - lastActive) / 60000)} min)`);
        }
      }
    } catch (err) {
      console.error('[StaleCheck] Erreur:', err);
    }
  }
  // Vérifier toutes les 5 minutes
  setInterval(checkStaleUsers, 5 * 60 * 1000);
  console.log('[StaleCheck] Vérification des users inactifs toutes les 5 minutes');

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

  // Gestionnaire d'erreurs global : renvoie toujours du JSON
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[API] Unhandled error:', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  });

  return app;
}

if (!process.env.VERCEL) {
  (async () => {
    const app = await buildApp();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`LE LOUI PARFAIT Server running on http://0.0.0.0:${PORT}`);
    });
  })();
}
