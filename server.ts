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
import { initializeApp as adminInitApp, cert as adminCert } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';
import { getStorage as adminGetStorage } from 'firebase-admin/storage';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

// Augment Express Request with multer's file property (déplacé plus bas avec authUser)

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

// --- Types étendus pour l'auth ---
declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File;
    authUser?: { uid: string; email?: string };
  }
}

// --- Rate Limiter simple (en mémoire, par IP) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;     // 30 requêtes/min par IP

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans 1 minute.' });
  }

  next();
}

// Rate limit plus strict pour les endpoints sensibles (reset-password, heartbeat)
const strictRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const STRICT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const STRICT_RATE_LIMIT_MAX = 10; // 10 requêtes/min

function strictRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = strictRateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    strictRateLimitMap.set(ip, { count: 1, resetAt: now + STRICT_RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > STRICT_RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Trop de requêtes sur cet endpoint. Réessayez plus tard.' });
  }

  next();
}

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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // SÉCURITÉ : Trust proxy (pour rate limiting correct derrière un proxy)
  app.set('trust proxy', 1);

  // SÉCURITÉ : Headers de sécurité (helmet)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite nécessite unsafe-inline/eval en dev
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        fontSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://www.googleapis.com", "https://firestore.googleapis.com", "https://identitytoolkit.googleapis.com", "wss:"],
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
  app.use(rateLimit); // Rate limit global sur toutes les routes API

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
            from: `"Le Oui Parfait" <${fromEmail}>`,
            to: email,
            subject: `${appName || 'Le Oui Parfait'} — Activez votre compte`,
            html: `
              <!DOCTYPE html>
              <html lang="fr">
                <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
                  <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
                    <tr><td align="center">
                      <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
                        <tr>
                          <td style="background:linear-gradient(135deg,#887D93,#6b5f78);padding:40px;text-align:center;">
                            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:600;letter-spacing:-0.01em;font-family:'Fraunces',Georgia,serif;">${escapeHtml(appName || 'Le Oui Parfait')}</h1>
                            <p style="margin:8px 0 0;color:#ebe7ee;font-size:13px;font-weight:400;">Espace de travail collaboratif</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:40px;">
                            <p style="font-size:16px;color:#1c1917;margin:0 0 16px;font-weight:600;">Bonjour ${escapeHtml(firstName || '')},</p>
                            <p style="font-size:15px;color:#57534e;line-height:1.7;margin:0 0 24px;">
                              Votre compte a été créé sur la plateforme. Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace de travail.
                            </p>
                            <p style="text-align:center;margin:0 0 32px;">
                              <a href="${link}" style="background:linear-gradient(135deg,#887D93,#6b5f78);color:#fff;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:15px;">
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
                                © ${new Date().getFullYear()} Le Oui Parfait. Tous droits réservés.
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
              <!DOCTYPE html>
              <html lang="fr">
                <body style="margin:0;padding:0;background:#f5f3f6;font-family:'Inter',Arial,Helvetica,sans-serif;">
                  <table width="100%" style="background:#f5f3f6;padding:40px 20px;">
                    <tr><td align="center">
                      <table width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(136,125,147,0.15);max-width:600px;width:100%;">
                        <tr>
                          <td style="background:linear-gradient(135deg,#887D93,#6b5f78);padding:32px 40px;text-align:center;">
                            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;letter-spacing:-0.01em;font-family:'Fraunces',Georgia,serif;">Rapport Quotidien</h1>
                            <p style="margin:6px 0 0;color:#ebe7ee;font-size:13px;">Le Oui Parfait — ${reportData?.date || new Date().toISOString().split('T')[0]}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:32px 40px;">
                            <p style="font-size:14px;color:#57534e;margin:0 0 20px;">
                              Généré par : <strong style="color:#1c1917;">${escapeHtml(reportData?.generatedBy || "Équipe d'Ingénierie")}</strong>
                            </p>

                            <table width="100%" style="border-collapse:separate;border-spacing:8px 0;margin-bottom:24px;">
                              <tr>
                                <td style="background:#f5f3f6;border-radius:10px;padding:16px;text-align:center;width:33%;">
                                  <p style="margin:0;font-size:24px;font-weight:700;color:#887D93;">${reportData?.attendanceSummary?.present || 0}</p>
                                  <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Présents</p>
                                </td>
                                <td style="background:#f5f3f6;border-radius:10px;padding:16px;text-align:center;width:33%;">
                                  <p style="margin:0;font-size:24px;font-weight:700;color:#10b981;">${reportData?.tasksSummary?.completed || 0}</p>
                                  <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">Terminées</p>
                                </td>
                                <td style="background:#f5f3f6;border-radius:10px;padding:16px;text-align:center;width:33%;">
                                  <p style="margin:0;font-size:24px;font-weight:700;color:#f59e0b;">${reportData?.tasksSummary?.inProgress || 0}</p>
                                  <p style="margin:4px 0 0;font-size:11px;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;">En cours</p>
                                </td>
                              </tr>
                            </table>

                            ${
                              reportData?.blockers?.length > 0
                                ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:0 0 24px;">
                                    <p style="color:#991b1b;margin:0 0 8px;font-weight:600;font-size:14px;">🚨 Blocages Critiques</p>
                                    <ul style="margin:0;padding-left:20px;color:#7f1d1d;font-size:13px;line-height:1.7;">
                                      ${reportData.blockers.map((b: any) => `<li><strong>${escapeHtml(b.taskTitle)}</strong> (${escapeHtml(b.assigneeName)}) : ${escapeHtml(b.reason)}</li>`).join('')}
                                    </ul>
                                  </div>`
                                : '<div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;padding:14px;margin:0 0 24px;"><p style="color:#166534;margin:0;font-size:13px;">✅ Aucun blocage actif signalé aujourd\'hui.</p></div>'
                            }

                            <div style="background:#f5f3f6;border-radius:10px;padding:16px;margin-bottom:24px;">
                              <p style="margin:0 0 10px;font-weight:600;color:#1c1917;font-size:14px;">📋 Priorités du jour</p>
                              <ul style="margin:0;padding-left:20px;color:#57534e;font-size:13px;line-height:1.7;">
                                ${(reportData?.prioritiesTomorrow || ['Aucune priorité urgente']).map((p: string) => `<li>${escapeHtml(p)}</li>`).join('')}
                              </ul>
                            </div>

                            <p style="text-align:center;margin:0 0 8px;">
                              <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="background:linear-gradient(135deg,#887D93,#6b5f78);color:#fff;padding:14px 32px;text-decoration:none;border-radius:10px;font-weight:600;display:inline-block;font-size:14px;">
                                Ouvrir le Tableau de Bord
                              </a>
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:20px 40px;background:#f5f3f6;border-top:1px solid #ebe7ee;">
                            <p style="font-size:11px;color:#a8a29e;margin:0;text-align:center;">
                              © ${new Date().getFullYear()} Le Oui Parfait. Rapport généré automatiquement.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
              </html>
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
        const recipients = orgData.reportEmailRecipients || [];
        if (recipients.length === 0) continue;

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
                html: `<p>Rapport automatique pour ${orgData.name} - ${todayStr}</p>
                       <p>Présents: ${present}/${expected} | Terminées: ${completed} | En cours: ${inProgress} | Bloquées: ${blocked}</p>`
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Le Oui Parfait Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
