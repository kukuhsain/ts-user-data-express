# Asynchronous Queue System

## Overview

A custom asynchronous queue implementation for managing database requests efficiently. The queue handles multiple simultaneous requests without blocking, with built-in deduplication, retry logic, and concurrency control.

## Features

✅ **Concurrent Processing** - Process multiple jobs simultaneously (configurable)
✅ **Request Deduplication** - Multiple requests for same data share result
✅ **Non-Blocking** - Async/await based, never blocks the event loop
✅ **Error Handling** - Automatic retry with exponential backoff
✅ **Statistics Tracking** - Monitor queue performance
✅ **Memory Efficient** - Automatic cleanup after completion

## Architecture

### Queue Flow

```
┌─────────────────────────────────────────────────────────┐
│              Multiple Simultaneous Requests              │
└──────────┬────────────┬────────────┬────────────────────┘
           │            │            │
           ▼            ▼            ▼
    ┌──────────────────────────────────────┐
    │       Check Deduplication Map         │
    │  (Same request already processing?)   │
    └──────────┬───────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   Duplicate         New Request
       │                │
       │                ▼
       │    ┌──────────────────────┐
       │    │   Add to Queue       │
       │    └──────────┬───────────┘
       │               │
       │               ▼
       │    ┌──────────────────────┐
       │    │  Check Concurrency   │
       │    │   (< 5 processing?)  │
       │    └──────────┬───────────┘
       │               │
       │       ┌───────┴────────┐
       │       │                │
       │    At Limit         Available
       │       │                │
       │    Wait in             ▼
       │    Queue      ┌──────────────────┐
       │               │  Process Task    │
       │               │   (Database)     │
       │               └────────┬─────────┘
       │                        │
       │                  ┌─────┴─────┐
       │                  │           │
       │               Success     Error
       │                  │           │
       │                  │           ▼
       │                  │    ┌──────────────┐
       │                  │    │ Retry Logic  │
       │                  │    │ (max 3x)     │
       │                  │    └──────┬───────┘
       │                  │           │
       └──────────────────┴───────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  Return Result   │
                │  to ALL waiting  │
                │  requests        │
                └──────────────────┘
```

### Deduplication Example

```
Time →

Request 1 for User:1 ──┐
                       ├─→ Single DB Call (200ms)
Request 2 for User:1 ──┤
                       ├─→ Shares Result
Request 3 for User:1 ──┘

Request 4 for User:2 ──→ Separate DB Call (200ms)

Result: 2 DB calls instead of 4
Savings: 50% reduction in database load
```

## Configuration

### Default Configuration

```typescript
const queue = createQueue<User>({
  concurrency: 5,      // Max 5 concurrent jobs
  maxRetries: 3,       // Retry up to 3 times on failure
  retryDelay: 1000,    // Wait 1s between retries
  deduplication: true  // Enable request deduplication
});
```

### Custom Configuration

```typescript
import { AsyncQueue } from "./queue/async-queue.js";

// High-throughput configuration
const highThroughputQueue = new AsyncQueue({
  concurrency: 10,     // More concurrent jobs
  maxRetries: 1,       // Fewer retries
  retryDelay: 500,     // Faster retry
  deduplication: true
});

// Reliable configuration
const reliableQueue = new AsyncQueue({
  concurrency: 2,      // Limited concurrency
  maxRetries: 5,       // More retries
  retryDelay: 2000,    // Longer retry delay
  deduplication: true
});

// No deduplication (for unique requests)
const uniqueQueue = new AsyncQueue({
  concurrency: 5,
  maxRetries: 3,
  retryDelay: 1000,
  deduplication: false // Each request is unique
});
```

## Usage

### Basic Usage

```typescript
import { createQueue } from "./queue/async-queue.js";

// Create queue
const queue = createQueue<User>();

// Enqueue a task
const user = await queue.enqueue(
  "user:1",                    // Unique key for deduplication
  async () => {                // Task function
    const result = await fetchFromDatabase(1);
    return result;
  }
);

console.log(user); // User data
```

### Integration with API

```typescript
// In users API
const databaseQueue = createQueue<User | null>({
  concurrency: 5,
  deduplication: true
});

router.get("/users/:id", async (req, res) => {
  const userId = req.params.id;
  const cacheKey = `user:${userId}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Enqueue database request
  const user = await databaseQueue.enqueue(
    cacheKey,
    () => simulateDatabaseCall(userId)
  );

  if (user) {
    cache.set(cacheKey, user);
    res.json(user);
  } else {
    res.status(404).json({ message: "User not found" });
  }
});
```

### Error Handling

```typescript
try {
  const result = await queue.enqueue("task:1", async () => {
    // This might fail
    return await riskyOperation();
  });
  
  console.log("Success:", result);
} catch (error) {
  // Failed after max retries
  console.error("Failed:", error.message);
}
```

## API Reference

### AsyncQueue Class

#### Constructor

```typescript
new AsyncQueue<T>(config?: Partial<QueueConfig>)
```

#### Methods

##### `enqueue(key: string, task: () => Promise<T>): Promise<T>`

Add a job to the queue.

**Parameters:**
- `key` - Unique identifier for deduplication
- `task` - Async function to execute

**Returns:** Promise that resolves with task result

**Example:**
```typescript
const user = await queue.enqueue("user:1", () => fetchUser(1));
```

##### `getStats(): QueueStats`

Get current queue statistics.

**Returns:**
```typescript
{
  pending: number;              // Jobs waiting in queue
  processing: number;           // Jobs currently executing
  completed: number;            // Successfully completed jobs
  failed: number;               // Failed jobs (after retries)
  averageProcessingTime: number; // Average time in ms
  totalProcessed: number;       // Total jobs processed
}
```

##### `getQueueSize(): number`

Get number of jobs waiting in queue.

##### `getProcessingCount(): number`

Get number of jobs currently processing.

##### `isEmpty(): boolean`

Check if queue is empty (no pending or processing jobs).

##### `clear(): void`

Clear all pending jobs. Processing jobs will complete.

##### `resetStats(): void`

Reset all statistics counters.

##### `drain(): Promise<void>`

Wait for all jobs to complete.

**Example:**
```typescript
await queue.drain();
console.log("All jobs completed");
```

## Queue Statistics

### Endpoint

```http
GET /api/v1/users/queue/stats
```

### Response

```json
{
  "pending": 3,
  "processing": 2,
  "completed": 1250,
  "failed": 5,
  "averageProcessingTime": 205,
  "totalProcessed": 1255
}
```

### Metrics Explanation

| Metric | Description |
|--------|-------------|
| `pending` | Jobs waiting to be processed |
| `processing` | Jobs currently being executed |
| `completed` | Successfully completed jobs |
| `failed` | Failed jobs after max retries |
| `averageProcessingTime` | Average time per job (ms) |
| `totalProcessed` | Total jobs processed (completed + failed) |

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Description |
|-----------|-----------|-------------|
| `enqueue()` | O(1) | Add job to queue |
| `processNext()` | O(1) | Process next job |
| `getStats()` | O(1) | Get statistics |

### Space Complexity

- **Per Job**: ~200 bytes (function + metadata)
- **Deduplication Map**: O(n) where n = unique concurrent keys
- **Total**: O(m + n) where m = queue size, n = processing jobs

### Concurrency Model

```
Single-threaded Event Loop:

Job 1 ─────────────→ (200ms DB) ────→ Complete
Job 2 ────→ (200ms DB) ────→ Complete
Job 3 ──→ (200ms DB) ──→ Complete
Job 4 → (200ms DB) → Complete
Job 5 → (wait) → Start when slot available

Max 5 concurrent = Max 5 concurrent I/O operations
```

## Benefits

### 1. Non-Blocking Operation

```typescript
// Traditional blocking (BAD)
const user1 = await db.query(1); // Blocks
const user2 = await db.query(2); // Waits for user1
const user3 = await db.query(3); // Waits for user2
// Total: ~600ms

// With queue (GOOD)
const [user1, user2, user3] = await Promise.all([
  queue.enqueue("user:1", () => db.query(1)),
  queue.enqueue("user:2", () => db.query(2)),
  queue.enqueue("user:3", () => db.query(3))
]);
// Total: ~200ms (parallel processing)
```

### 2. Request Deduplication

```typescript
// Without deduplication
100 requests for User:1 = 100 DB calls

// With deduplication
100 requests for User:1 = 1 DB call, 99 share result
```

### 3. Controlled Concurrency

```typescript
// Without queue
1000 simultaneous requests → 1000 concurrent DB connections (💥 overload)

// With queue (concurrency: 5)
1000 simultaneous requests → max 5 DB connections (✅ controlled)
```

## Testing

### Test Queue Functionality

```bash
# Start server
pnpm start

# Make multiple simultaneous requests for same user
# (should be deduplicated)
for i in {1..10}; do
  curl http://localhost:3000/api/v1/users/1 &
done
wait

# Check queue stats
curl http://localhost:3000/api/v1/users/queue/stats
```

### Test Concurrency

```bash
# Make many requests for different users
# (should process with limited concurrency)
for i in {1..20}; do
  curl http://localhost:3000/api/v1/users/$((i % 3 + 1)) &
done
wait

# Check stats - should show controlled processing
curl http://localhost:3000/api/v1/users/queue/stats
```

### Performance Test

```bash
# Without queue: Sequential
time for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null
done
# Expected: ~2000ms (10 × 200ms)

# With queue: Parallel + Deduplication
time for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null &
done
wait
# Expected: ~200ms (1 DB call shared by all)
```

## Advanced Usage

### Custom Retry Logic

```typescript
const queue = new AsyncQueue({
  concurrency: 5,
  maxRetries: 3,
  retryDelay: 1000
});

// Will retry up to 3 times on failure
const result = await queue.enqueue("task:1", async () => {
  const response = await fetch("https://api.example.com/data");
  if (!response.ok) throw new Error("API error");
  return response.json();
});
```

### Priority Queue (Future Enhancement)

```typescript
// Not yet implemented, but could be added
interface PriorityQueueJob<T> extends QueueJob<T> {
  priority: number; // Higher = processed first
}
```

### Batch Processing

```typescript
// Process multiple items
const userIds = [1, 2, 3, 4, 5];

const users = await Promise.all(
  userIds.map(id =>
    queue.enqueue(`user:${id}`, () => fetchUser(id))
  )
);

console.log(`Fetched ${users.length} users`);
```

### Monitoring

```typescript
// Set up interval to monitor queue
setInterval(() => {
  const stats = queue.getStats();
  
  if (stats.pending > 10) {
    console.warn(`Queue backlog: ${stats.pending} pending jobs`);
  }
  
  if (stats.failed > 100) {
    console.error(`High failure rate: ${stats.failed} failed jobs`);
  }
  
  console.log(`Queue health: ${stats.completed} completed, ${stats.processing} processing`);
}, 5000);
```

## Comparison with Bull

| Feature | This Implementation | Bull |
|---------|-------------------|------|
| Dependencies | ✅ None | ❌ Redis required |
| Setup | ✅ Simple | ⚠️ Complex |
| Persistence | ❌ In-memory | ✅ Redis-backed |
| Distributed | ❌ Single instance | ✅ Multi-instance |
| Deduplication | ✅ Built-in | ⚠️ Manual |
| Concurrency | ✅ Configurable | ✅ Configurable |
| Retry Logic | ✅ Built-in | ✅ Built-in |
| Best For | Single server | Distributed systems |

## When to Use This Queue

✅ **Good For:**
- Single-server applications
- Lightweight async processing
- Request deduplication needs
- Simple retry logic
- No external dependencies

❌ **Not Good For:**
- Multi-server deployments (no shared state)
- Job persistence (in-memory only)
- Complex workflows
- Scheduled jobs
- Job priorities

## Best Practices

1. ✅ **Use Deduplication** - For idempotent operations
2. ✅ **Set Appropriate Concurrency** - Balance load vs throughput
3. ✅ **Monitor Statistics** - Track queue health
4. ✅ **Handle Errors** - Implement proper error handling
5. ✅ **Use with Cache** - Queue + Cache = optimal performance

## Troubleshooting

### Issue: Queue Backing Up

**Symptoms**: `pending` count increasing

**Solutions:**
- Increase concurrency
- Optimize task execution time
- Add more cache layers

### Issue: High Failure Rate

**Symptoms**: `failed` count increasing

**Solutions:**
- Increase `maxRetries`
- Increase `retryDelay`
- Check database connectivity
- Review error logs

### Issue: Slow Processing

**Symptoms**: `averageProcessingTime` high

**Solutions:**
- Optimize database queries
- Add indexes
- Increase concurrency
- Use caching

## License

Part of the ts-user-data-express project.

