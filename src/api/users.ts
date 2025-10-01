import express from "express";

import type { CacheStats } from "../cache/lru-cache.js";
import type { QueueStats } from "../queue/async-queue.js";
import type ErrorResponse from "../interfaces/error-response.js";

import LRUCache from "../cache/lru-cache.js";
import { createQueue } from "../queue/async-queue.js";
import { createRateLimiter } from "../middleware/rate-limiter.js";

const router = express.Router();

// Rate limiter: 10 requests/minute, 5 requests/10 seconds burst
const rateLimiter = createRateLimiter(
  60 * 1000, // 1 minute window
  10, // 10 requests per minute
  10 * 1000, // 10 second burst window
  5, // 5 requests per burst window
);

// Apply rate limiter to all routes
router.use(rateLimiter);

// User interface
type User = {
  id: number;
  name: string;
  email: string;
};

// Mock user data
const mockUsers: Record<number, User> = {
  1: { id: 1, name: "John Doe", email: "john@example.com" },
  2: { id: 2, name: "Jane Smith", email: "jane@example.com" },
  3: { id: 3, name: "Alice Johnson", email: "alice@example.com" },
};

// LRU Cache with 100 capacity and 60 second TTL
const userCache = new LRUCache<User>(100, 60);

// Async Queue with 5 concurrent requests and deduplication
const databaseQueue = createQueue<User | null>({
  concurrency: 5,
  maxRetries: 3,
  retryDelay: 1000,
  deduplication: true,
});

// Simulate database call with 200ms delay
function simulateDatabaseCall(userId: number): Promise<User | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const user = mockUsers[userId];
      resolve(user || null);
    }, 200);
  });
}

// GET /users/cache/stats - Get cache statistics
router.get<object, CacheStats>("/cache/stats", (req, res) => {
  const stats = userCache.getStats();
  res.json(stats);
});

// GET /users/queue/stats - Get queue statistics
router.get<object, QueueStats>("/queue/stats", (req, res) => {
  const stats = databaseQueue.getStats();
  res.json(stats);
});

// GET /users/:id - Retrieve user data by ID
router.get<{ id: string }, User | ErrorResponse>("/:id", async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);

  // Validate that the ID is a valid number
  if (Number.isNaN(userId)) {
    res.status(400).json({
      message: "Invalid user ID. Must be a number.",
    });
    return;
  }

  const cacheKey = `user:${userId}`;

  // Check if data is in cache
  const cachedUser = userCache.get(cacheKey);
  if (cachedUser) {
    res.json(cachedUser);
    return;
  }

  // Enqueue database request (with automatic deduplication)
  // Multiple simultaneous requests for the same user will share the result
  const user = await databaseQueue.enqueue(
    cacheKey,
    () => simulateDatabaseCall(userId),
  );

  if (!user) {
    res.status(404).json({
      message: `User with ID ${userId} not found.`,
    });
    return;
  }

  // Store in cache
  userCache.set(cacheKey, user);

  res.json(user);
});

export default router;
