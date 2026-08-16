export default (req: any, res: any) => {
  res.status(200).json({ ok: true, ts: Date.now() });
};
