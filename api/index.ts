let app: any = null;
let buildError: any = null;

export default async (req: any, res: any) => {
  try {
    if (!app && !buildError) {
      const mod = await import('../server');
      app = await mod.buildApp();
    }
    if (buildError) {
      throw buildError;
    }
    app(req, res);
  } catch (err: any) {
    console.error('[API] Function error:', err);
    res.status(500).json({
      error: err.message || 'Server error',
      stack: err.stack || '',
      code: err.code || ''
    });
  }
};
