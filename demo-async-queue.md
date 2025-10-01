# Async Queue Testing Guide

## ✅ Implementation Complete

Asynchronous processing with request queuing has been successfully implemented:

- ✅ **Queue-based processing** - Database requests managed through async queue
- ✅ **Non-blocking operation** - Multiple simultaneous requests handled efficiently
- ✅ **Request deduplication** - Same requests share results
- ✅ **Concurrency control** - Max 5 concurrent database calls
- ✅ **Retry logic** - Automatic retry on failures
- ✅ **Statistics tracking** - Monitor queue performance

## Quick Start

### 1. Start the Server

```bash
pnpm start
```

### 2. Make a Request

```bash
curl http://localhost:3000/api/v1/users/1
```

**Expected Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

### 3. Check Queue Statistics

```bash
curl http://localhost:3000/api/v1/users/queue/stats
```

**Expected Response:**
```json
{
  "pending": 0,
  "processing": 0,
  "completed": 1,
  "failed": 0,
  "averageProcessingTime": 202,
  "totalProcessed": 1
}
```

## Test Scenarios

### Scenario 1: Request Deduplication

**Goal**: Verify that multiple simultaneous requests for the same user share a single database call

```bash
echo "=== Testing Request Deduplication ==="

# Make 10 simultaneous requests for User 1
echo "Making 10 simultaneous requests for User 1..."
for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null &
done
wait

# Check queue stats
echo -e "\nQueue Statistics:"
curl -s http://localhost:3000/api/v1/users/queue/stats | jq
```

**Expected Result:**
- All 10 requests return the same user data
- Queue shows only 1 completed job (not 10)
- Average processing time: ~200ms

**Why?** The queue deduplicates requests with the same key (`user:1`), so only one database call is made and the result is shared with all 10 requests.

### Scenario 2: Concurrency Control

**Goal**: Verify that the queue limits concurrent processing to 5 jobs

```bash
echo "=== Testing Concurrency Control ==="

# Clear cache to force database calls
# (restart server or wait 60s for cache expiry)

# Make 20 requests for different users
echo "Making 20 requests for different users..."
start_time=$(date +%s)

for i in {1..20}; do
  user_id=$((i % 3 + 1))  # Cycle through users 1, 2, 3
  curl -s http://localhost:3000/api/v1/users/$user_id > /dev/null &
  
  # Slight delay to prevent cache hits
  sleep 0.1
done
wait

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "Total time: ${duration}s"
echo -e "\nQueue Statistics:"
curl -s http://localhost:3000/api/v1/users/queue/stats | jq
```

**Expected Result:**
- Processing time: ~800-1000ms (not 4000ms)
- Queue processed requests in batches of 5
- Some requests waited in queue while others processed

**Why?** With concurrency limit of 5, the queue processes 5 requests at a time. Total time = (20 requests / 5 concurrency) × 200ms ≈ 800ms

### Scenario 3: Non-Blocking Operation

**Goal**: Demonstrate that the server remains responsive during queue processing

```bash
echo "=== Testing Non-Blocking Operation ==="

# Terminal 1: Start flood of requests
echo "Flooding with requests..."
for i in {1..50}; do
  curl -s http://localhost:3000/api/v1/users/$((i % 3 + 1)) > /dev/null &
done

# Terminal 2 (run in parallel): Check if server is still responsive
sleep 0.5
echo "Testing server responsiveness during load..."
curl -w "\nTime: %{time_total}s\n" http://localhost:3000/api/v1

# Wait for all requests
wait
echo "All requests completed"
```

**Expected Result:**
- API root endpoint responds quickly even during load
- No blocking or timeouts
- Server remains responsive

**Why?** Queue processes requests asynchronously without blocking the event loop.

### Scenario 4: Cache + Queue Integration

**Goal**: Demonstrate optimal behavior with both cache and queue

```bash
echo "=== Testing Cache + Queue Integration ==="

# Request 1: Cache miss, queued for processing
echo "Request 1 (cache miss, ~200ms):"
time curl -s http://localhost:3000/api/v1/users/1 > /dev/null

# Request 2: Cache hit, instant
echo -e "\nRequest 2 (cache hit, ~5ms):"
time curl -s http://localhost:3000/api/v1/users/1 > /dev/null

# Request 3: 10 simultaneous requests, all cache hits
echo -e "\n10 simultaneous requests (all cache hits):"
time for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null &
done
wait

# Check stats
echo -e "\nCache Stats:"
curl -s http://localhost:3000/api/v1/users/cache/stats | jq

echo -e "\nQueue Stats:"
curl -s http://localhost:3000/api/v1/users/queue/stats | jq
```

**Expected Result:**
```
Request 1: ~0.2s (cache miss + DB call)
Request 2: ~0.01s (cache hit)
10 requests: ~0.02s total (all cache hits)

Cache: 11 hits, 1 miss
Queue: 1 completed job
```

### Scenario 5: Performance Comparison

**Goal**: Compare performance with and without deduplication

```bash
#!/bin/bash

echo "=== Performance Comparison ==="

# Test 1: Sequential requests (worst case)
echo "Test 1: 10 Sequential Requests"
start=$(date +%s%N)
for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null
done
end=$(date +%s%N)
seq_time=$(( (end - start) / 1000000 ))
echo "Time: ${seq_time}ms"

# Wait for cache to expire
sleep 61

# Test 2: Parallel requests with deduplication (best case)
echo -e "\nTest 2: 10 Parallel Requests (with deduplication)"
start=$(date +%s%N)
for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null &
done
wait
end=$(date +%s%N)
par_time=$(( (end - start) / 1000000 ))
echo "Time: ${par_time}ms"

# Calculate speedup
speedup=$((seq_time / par_time))
echo -e "\nSpeedup: ${speedup}x faster"
```

**Expected Results:**
```
Sequential: ~2000ms (10 × 200ms)
Parallel: ~200ms (1 DB call shared)
Speedup: ~10x faster
```

### Scenario 6: Statistics Monitoring

**Goal**: Monitor queue behavior in real-time

```bash
echo "=== Real-time Statistics Monitoring ==="

# Terminal 1: Generate load
echo "Generating continuous load..."
while true; do
  for i in {1..5}; do
    curl -s http://localhost:3000/api/v1/users/$((RANDOM % 3 + 1)) > /dev/null &
  done
  sleep 2
done

# Terminal 2: Monitor stats (run in separate terminal)
watch -n 1 'echo "=== Queue Stats ===" && curl -s http://localhost:3000/api/v1/users/queue/stats | jq && echo && echo "=== Cache Stats ===" && curl -s http://localhost:3000/api/v1/users/cache/stats | jq'
```

**What to Watch:**
- `pending`: Should stay low (< 5) with proper concurrency
- `processing`: Should be ≤ 5 (concurrency limit)
- `completed`: Should increase steadily
- `averageProcessingTime`: Should be ~200ms

### Scenario 7: Error Handling & Retry

**Goal**: Simulate failures and verify retry logic

This would require modifying the database call to occasionally fail:

```typescript
// Temporary modification for testing
function simulateDatabaseCall(userId: number): Promise<User | null> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate random failures (20% chance)
      if (Math.random() < 0.2) {
        reject(new Error("Database connection timeout"));
        return;
      }
      
      const user = mockUsers[userId];
      resolve(user || null);
    }, 200);
  });
}
```

```bash
# Make requests and observe retry behavior
for i in {1..20}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null &
done
wait

# Check stats - some might have failed after retries
curl http://localhost:3000/api/v1/users/queue/stats | jq
```

## Comprehensive Test Script

Save as `test-async-queue.sh`:

```bash
#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  Async Queue Comprehensive Test"
echo "========================================"

# Test 1: Request Deduplication
echo -e "\n${YELLOW}Test 1: Request Deduplication${NC}"
echo "Making 10 simultaneous requests for User 1..."

start=$(date +%s%N)
for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null &
done
wait
end=$(date +%s%N)
duration=$(( (end - start) / 1000000 ))

stats=$(curl -s http://localhost:3000/api/v1/users/queue/stats)
completed=$(echo $stats | jq -r '.completed')

echo "Duration: ${duration}ms"
echo "Queue jobs completed: $completed"

if [ "$completed" -le 2 ]; then
  echo -e "${GREEN}✓ Deduplication working (1-2 jobs instead of 10)${NC}"
else
  echo -e "${RED}✗ Deduplication may not be working${NC}"
fi

# Wait for cache expiry
echo -e "\n${YELLOW}Waiting 61 seconds for cache expiry...${NC}"
sleep 61

# Test 2: Concurrency Control
echo -e "\n${YELLOW}Test 2: Concurrency Control${NC}"
echo "Making 15 requests for different users..."

start=$(date +%s%N)
for i in {1..15}; do
  user_id=$((i % 3 + 1))
  curl -s http://localhost:3000/api/v1/users/$user_id > /dev/null &
  sleep 0.1
done
wait
end=$(date +%s%N)
duration=$(( (end - start) / 1000000 ))

echo "Duration: ${duration}ms"

if [ "$duration" -lt 3000 ]; then
  echo -e "${GREEN}✓ Concurrent processing working${NC}"
else
  echo -e "${RED}✗ Processing may be sequential${NC}"
fi

# Test 3: Cache Integration
echo -e "\n${YELLOW}Test 3: Cache Integration${NC}"

# Clear by waiting
sleep 61

echo "First request (cache miss):"
time1=$(curl -s -w "%{time_total}" -o /dev/null http://localhost:3000/api/v1/users/1)
echo "Time: ${time1}s"

echo "Second request (cache hit):"
time2=$(curl -s -w "%{time_total}" -o /dev/null http://localhost:3000/api/v1/users/1)
echo "Time: ${time2}s"

time1_ms=$(echo "$time1 * 1000" | bc | cut -d. -f1)
time2_ms=$(echo "$time2 * 1000" | bc | cut -d. -f1)

if [ "$time1_ms" -gt 150 ] && [ "$time2_ms" -lt 50 ]; then
  echo -e "${GREEN}✓ Cache working correctly${NC}"
else
  echo -e "${YELLOW}⚠ Cache behavior unexpected${NC}"
fi

# Final Statistics
echo -e "\n${YELLOW}Final Statistics${NC}"
echo "Cache Stats:"
curl -s http://localhost:3000/api/v1/users/cache/stats | jq

echo -e "\nQueue Stats:"
curl -s http://localhost:3000/api/v1/users/queue/stats | jq

echo -e "\n========================================"
echo -e "         ${GREEN}Test Suite Complete${NC}"
echo -e "========================================\n"
```

Make executable and run:
```bash
chmod +x test-async-queue.sh
./test-async-queue.sh
```

## Understanding the Output

### Queue Statistics

```json
{
  "pending": 3,        // Waiting to be processed
  "processing": 2,     // Currently executing
  "completed": 1250,   // Successfully finished
  "failed": 5,         // Failed after retries
  "averageProcessingTime": 205,  // Avg time in ms
  "totalProcessed": 1255  // Total handled
}
```

### Performance Metrics

**Ideal Queue Health:**
- `pending`: Low (< 10)
- `processing`: ≤ concurrency limit (5)
- `completed`: High and increasing
- `failed`: Low (< 1%)
- `averageProcessingTime`: ~200ms (DB call time)

**Warning Signs:**
- `pending`: High (> 50) → Backlog building up
- `processing`: Always at max → May need more concurrency
- `failed`: High → Check error logs
- `averageProcessingTime`: >> 200ms → Database slow

## Performance Benefits

### Without Queue (Sequential)

```
Request 1 → DB (200ms) → Response
Request 2 → Wait → DB (200ms) → Response  
Request 3 → Wait → DB (200ms) → Response
Request 4 → Wait → DB (200ms) → Response
Request 5 → Wait → DB (200ms) → Response

Total: 1000ms for 5 requests
```

### With Queue (Parallel)

```
Request 1 ──┐
Request 2 ──┤
Request 3 ──┼→ Queue → 5 parallel DB calls (200ms) → Responses
Request 4 ──┤
Request 5 ──┘

Total: 200ms for 5 requests
Speedup: 5x faster!
```

### With Queue + Deduplication

```
Request 1 for User:1 ──┐
Request 2 for User:1 ──┤
Request 3 for User:1 ──┼→ 1 DB call → Shared result
Request 4 for User:1 ──┤
Request 5 for User:1 ──┘

Total: 200ms for 5 requests
Database calls: 1 instead of 5
Speedup: 5x reduction in DB load!
```

## Combined System Performance

### Full Stack: Rate Limiter + Cache + Queue

```
Request Flow:

1. Rate Limiter Check (< 1ms)
   ↓
2. Cache Lookup (< 1ms)
   ↓ (if miss)
3. Queue Enqueue (< 1ms)
   ↓
4. Concurrent Processing (200ms, up to 5 parallel)
   ↓
5. Cache Store (< 1ms)
   ↓
6. Response

First request: ~202ms
Subsequent requests: ~2ms (cache hit)
Concurrent same requests: ~202ms shared
```

## Best Practices for Testing

1. **Clear Cache Between Tests** - Wait 61 seconds or restart server
2. **Use Different Users** - To avoid cache hits when testing concurrency
3. **Monitor Statistics** - Use `/queue/stats` endpoint
4. **Test Under Load** - Use multiple simultaneous requests
5. **Verify Deduplication** - Check that jobs completed < requests made

## Troubleshooting

### Issue: Queue Not Processing

**Check:**
```bash
curl http://localhost:3000/api/v1/users/queue/stats
```

If `pending` is high but `processing` is 0, restart the server.

### Issue: Slow Response Times

**Check:**
```bash
curl http://localhost:3000/api/v1/users/queue/stats
```

If `averageProcessingTime` >> 200ms, database might be slow.

### Issue: High Failure Rate

**Check:**
```bash
curl http://localhost:3000/api/v1/users/queue/stats
```

If `failed` is increasing, check server logs for errors.

## Summary

The async queue provides:

✅ **Non-blocking** - Multiple requests handled concurrently
✅ **Deduplication** - Same requests share results
✅ **Controlled Load** - Max 5 concurrent database calls
✅ **Automatic Retry** - Failed requests retried automatically
✅ **Observable** - Statistics endpoint for monitoring
✅ **Efficient** - Up to 10x performance improvement

Combined with cache and rate limiter, the API can handle high traffic efficiently while protecting backend resources! 🚀

