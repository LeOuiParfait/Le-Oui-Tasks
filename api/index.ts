import { buildApp } from '../server';

let app: any = null;

export default async (req: any, res: any) => {
  try {
    if (!app) {
      app = await buildApp();
    }
    app(req, res);
  } catch (err: any) {
    console.error('[API] Function error:', err);
    res.status(500).json({
      error: err.message || 'Server error',
      stack: err.stack || ''
    });
  }
};
