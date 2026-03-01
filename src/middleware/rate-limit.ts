import type { Request, Response, NextFunction } from "express";

export interface RateLimitOptions {
  windowMs: number; // milliseconds
  max: number; // max requests per window
}

export class RateLimiter {
  private hits = new Map<string, { count: number; resetTime: number }>();
  private windowMs: number;
  private max: number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || req.socket.remoteAddress || "unknown";
      const now = Date.now();

      let record = this.hits.get(key);
      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + this.windowMs };
        this.hits.set(key, record);
      }

      record.count += 1;

      if (record.count > this.max) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        res.setHeader("Retry-After", retryAfter);
        res.status(429).json({
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        });
        return;
      }

      // Set headers for rate limit info
      res.setHeader("X-RateLimit-Limit", this.max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.max - record.count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

      next();
    };
  }

  // Clean up old entries (call periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetTime) {
        this.hits.delete(key);
      }
    }
  }
}

// Default rate limiter (1 minute window, 100 requests)
export const defaultRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 100,
});

export const rateLimitMiddleware = defaultRateLimiter.middleware();
