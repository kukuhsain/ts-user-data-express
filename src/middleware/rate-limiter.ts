import type { NextFunction, Request, Response } from "express";

/**
 * Rate limit window tracking
 */
type RateLimitWindow = {
  requests: number[];
  burstRequests: number[];
};

/**
 * Rate limiter configuration
 */
type RateLimiterConfig = {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  burstWindowMs: number; // Burst window in milliseconds
  burstMaxRequests: number; // Max requests in burst window
  keyGenerator?: (req: Request) => string; // Function to generate rate limit key
};

/**
 * Sophisticated Rate Limiter with Burst Handling
 *
 * Features:
 * - Sliding window algorithm for accurate rate limiting
 * - Burst capacity to handle traffic spikes
 * - Per-IP tracking (configurable)
 * - Automatic cleanup of old entries
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private store: Map<string, RateLimitWindow>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = {
      ...config,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
    };
    this.store = new Map();

    // Start cleanup task to remove old entries
    this.startCleanupTask();
  }

  /**
   * Default key generator - uses IP address
   */
  private defaultKeyGenerator(req: Request): string {
    return req.ip || req.socket.remoteAddress || "unknown";
  }

  /**
   * Clean up old request timestamps
   */
  private cleanupOldEntries(key: string, now: number): void {
    const window = this.store.get(key);
    if (!window) {
      return;
    }

    // Remove timestamps older than the main window
    window.requests = window.requests.filter(
      timestamp => now - timestamp < this.config.windowMs,
    );

    // Remove timestamps older than the burst window
    window.burstRequests = window.burstRequests.filter(
      timestamp => now - timestamp < this.config.burstWindowMs,
    );

    // If no requests left, remove the key entirely
    if (window.requests.length === 0 && window.burstRequests.length === 0) {
      this.store.delete(key);
    }
  }

  /**
   * Check if request is allowed
   */
  private isAllowed(key: string): { allowed: boolean; retryAfter?: number; reason?: string } {
    const now = Date.now();
    let window = this.store.get(key);

    if (!window) {
      window = {
        requests: [],
        burstRequests: [],
      };
      this.store.set(key, window);
    }

    // Clean up old entries
    this.cleanupOldEntries(key, now);

    // Check burst window (10 seconds, 5 requests)
    const burstRequestsInWindow = window.burstRequests.filter(
      timestamp => now - timestamp < this.config.burstWindowMs,
    ).length;

    if (burstRequestsInWindow >= this.config.burstMaxRequests) {
      const oldestBurstRequest = Math.min(...window.burstRequests);
      const retryAfter = Math.ceil(
        (oldestBurstRequest + this.config.burstWindowMs - now) / 1000,
      );
      return {
        allowed: false,
        retryAfter,
        reason: `Burst limit exceeded. Maximum ${this.config.burstMaxRequests} requests per ${this.config.burstWindowMs / 1000} seconds.`,
      };
    }

    // Check main window (1 minute, 10 requests)
    const requestsInWindow = window.requests.filter(
      timestamp => now - timestamp < this.config.windowMs,
    ).length;

    if (requestsInWindow >= this.config.maxRequests) {
      const oldestRequest = Math.min(...window.requests);
      const retryAfter = Math.ceil(
        (oldestRequest + this.config.windowMs - now) / 1000,
      );
      return {
        allowed: false,
        retryAfter,
        reason: `Rate limit exceeded. Maximum ${this.config.maxRequests} requests per ${this.config.windowMs / 1000} seconds.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request
   */
  private recordRequest(key: string): void {
    const now = Date.now();
    const window = this.store.get(key);

    if (window) {
      window.requests.push(now);
      window.burstRequests.push(now);
    }
  }

  /**
   * Middleware function
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.config.keyGenerator(req);
      const result = this.isAllowed(key);

      if (!result.allowed) {
        res.status(429).json({
          message: result.reason || "Too many requests",
          retryAfter: result.retryAfter,
        });
        return;
      }

      // Record the request
      this.recordRequest(key);

      // Add rate limit headers
      const window = this.store.get(key);
      if (window) {
        const now = Date.now();
        const requestsInWindow = window.requests.filter(
          timestamp => now - timestamp < this.config.windowMs,
        ).length;
        const burstRequestsInWindow = window.burstRequests.filter(
          timestamp => now - timestamp < this.config.burstWindowMs,
        ).length;

        res.setHeader("X-RateLimit-Limit", this.config.maxRequests.toString());
        res.setHeader("X-RateLimit-Remaining", (this.config.maxRequests - requestsInWindow).toString());
        res.setHeader("X-RateLimit-Burst-Limit", this.config.burstMaxRequests.toString());
        res.setHeader("X-RateLimit-Burst-Remaining", (this.config.burstMaxRequests - burstRequestsInWindow).toString());
      }

      next();
    };
  }

  /**
   * Start background cleanup task
   */
  private startCleanupTask(): void {
    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key] of this.store.entries()) {
        this.cleanupOldEntries(key, now);
      }
    }, 30000);

    // Ensure cleanup stops when process exits
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop background cleanup task
   */
  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current store size (for monitoring)
   */
  getStoreSize(): number {
    return this.store.size;
  }

  /**
   * Get rate limit info for a key
   */
  getRateLimitInfo(key: string): {
    requestsInWindow: number;
    burstRequestsInWindow: number;
    remainingRequests: number;
    remainingBurstRequests: number;
  } {
    const window = this.store.get(key);
    if (!window) {
      return {
        requestsInWindow: 0,
        burstRequestsInWindow: 0,
        remainingRequests: this.config.maxRequests,
        remainingBurstRequests: this.config.burstMaxRequests,
      };
    }

    const now = Date.now();
    const requestsInWindow = window.requests.filter(
      timestamp => now - timestamp < this.config.windowMs,
    ).length;
    const burstRequestsInWindow = window.burstRequests.filter(
      timestamp => now - timestamp < this.config.burstWindowMs,
    ).length;

    return {
      requestsInWindow,
      burstRequestsInWindow,
      remainingRequests: Math.max(0, this.config.maxRequests - requestsInWindow),
      remainingBurstRequests: Math.max(0, this.config.burstMaxRequests - burstRequestsInWindow),
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopCleanupTask();
    this.store.clear();
  }
}

/**
 * Create a rate limiter middleware
 *
 * @param windowMs - Time window in milliseconds
 * @param maxRequests - Maximum requests per window
 * @param burstWindowMs - Burst window in milliseconds
 * @param burstMaxRequests - Maximum requests in burst window
 * @returns Express middleware
 */
export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  burstWindowMs: number,
  burstMaxRequests: number,
) {
  const limiter = new RateLimiter({
    windowMs,
    maxRequests,
    burstWindowMs,
    burstMaxRequests,
  });

  return limiter.middleware();
}

export default RateLimiter;
