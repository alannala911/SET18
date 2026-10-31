export function rateLimit({ max, windowMs, message = "For mange forespørsler. Prøv igjen senere." }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5000) hits.clear();
    const entry = hits.get(req.ip);
    const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + windowMs };
    current.count += 1;
    hits.set(req.ip, current);
    if (current.count > max) return res.status(429).json({ message });
    next();
  };
}
