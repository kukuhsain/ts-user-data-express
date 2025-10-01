import express from "express";
import type ErrorResponse from "../interfaces/error-response.js";

const router = express.Router();

// User interface
interface User {
  id: number;
  name: string;
  email: string;
}

// Mock user data
const mockUsers: Record<number, User> = {
  1: { id: 1, name: "John Doe", email: "john@example.com" },
  2: { id: 2, name: "Jane Smith", email: "jane@example.com" },
  3: { id: 3, name: "Alice Johnson", email: "alice@example.com" },
};

// In-memory cache
const cache: Record<number, User> = {};

// Simulate database call with 200ms delay
const simulateDatabaseCall = (userId: number): Promise<User | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const user = mockUsers[userId];
      resolve(user || null);
    }, 200);
  });
};

// GET /users/:id - Retrieve user data by ID
router.get<{ id: string }, User | ErrorResponse>("/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  // Validate that the ID is a valid number
  if (isNaN(userId)) {
    res.status(400).json({
      message: "Invalid user ID. Must be a number.",
    });
    return;
  }

  // Check if data is in cache
  if (cache[userId]) {
    console.log(`Cache hit for user ${userId}`);
    res.json(cache[userId]);
    return;
  }

  console.log(`Cache miss for user ${userId}. Fetching from database...`);

  // Simulate database call
  const user = await simulateDatabaseCall(userId);

  if (!user) {
    res.status(404).json({
      message: `User with ID ${userId} not found.`,
    });
    return;
  }

  // Store in cache
  cache[userId] = user;

  res.json(user);
});

export default router;

