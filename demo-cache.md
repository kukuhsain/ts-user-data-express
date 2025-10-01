# LRU Cache Demonstration Guide

## Features Implemented ✅

1. **LRU Eviction Strategy** - Automatically removes least recently used items when capacity is reached
2. **60-Second TTL** - Cache entries expire after 60 seconds
3. **Cache Statistics** - Tracks hits, misses, evictions, expirations, and size
4. **Background Cleanup** - Automatic task every 10 seconds to clear stale entries

## API Endpoints

### 1. Get User by ID (with caching)
```bash
GET /api/v1/users/:id
```

### 2. Get Cache Statistics
```bash
GET /api/v1/users/cache/stats
```

## Testing the Cache

### Step 1: Start the Server
```bash
pnpm start
```

### Step 2: Test Cache Miss (First Request)
```bash
# Request user 1 (not in cache) - takes ~200ms
curl -w "\nTime: %{time_total}s\n" http://localhost:3000/api/v1/users/1
```

**Expected Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Server Log:**
```
[Cache MISS] User 1. Fetching from database...
[Cache SET] User 1 stored in cache with 60s TTL
```

### Step 3: Test Cache Hit (Immediate Response)
```bash
# Request user 1 again (in cache) - instant
curl -w "\nTime: %{time_total}s\n" http://localhost:3000/api/v1/users/1
```

**Server Log:**
```
[Cache HIT] User 1 retrieved from cache
```

### Step 4: View Cache Statistics
```bash
curl http://localhost:3000/api/v1/users/cache/stats
```

**Expected Response:**
```json
{
  "hits": 1,
  "misses": 1,
  "size": 1,
  "capacity": 100,
  "evictions": 0,
  "expirations": 0
}
```

### Step 5: Test Multiple Users (LRU Behavior)
```bash
# Add multiple users to cache
curl http://localhost:3000/api/v1/users/1
curl http://localhost:3000/api/v1/users/2
curl http://localhost:3000/api/v1/users/3

# Check stats - should show 3 items in cache
curl http://localhost:3000/api/v1/users/cache/stats
```

**Expected Stats:**
```json
{
  "hits": 1,
  "misses": 4,
  "size": 3,
  "capacity": 100,
  "evictions": 0,
  "expirations": 0
}
```

### Step 6: Test TTL Expiration (60 seconds)
```bash
# Request user 1
curl http://localhost:3000/api/v1/users/1

# Wait 61 seconds
sleep 61

# Request user 1 again - should be expired (cache miss)
curl http://localhost:3000/api/v1/users/1

# Check stats - expirations should increment
curl http://localhost:3000/api/v1/users/cache/stats
```

**Server Log After 61 Seconds:**
```
[Cache MISS] User 1. Fetching from database...
[Cache SET] User 1 stored in cache with 60s TTL
```

### Step 7: Test Background Cleanup
The background task runs every 10 seconds and removes expired entries.

**Server Log (after entries expire):**
```
[Cache Cleanup] Removed 2 expired entries
```

### Step 8: Test LRU Eviction
To test eviction, you'd need to fill the cache to capacity (100 items). The cache will automatically remove the least recently used item.

```bash
# Fill cache to demonstrate LRU eviction
for i in {1..101}; do
  curl http://localhost:3000/api/v1/users/$i
done

# Check stats - evictions should be > 0
curl http://localhost:3000/api/v1/users/cache/stats
```

### Step 9: Test Error Cases
```bash
# Non-existent user (404)
curl -i http://localhost:3000/api/v1/users/999

# Invalid user ID (400)
curl -i http://localhost:3000/api/v1/users/abc
```

## Performance Comparison

### Without Cache
```bash
# First request: ~200ms
time curl http://localhost:3000/api/v1/users/1
```

### With Cache (Second Request)
```bash
# Cached request: ~5-10ms (40x faster!)
time curl http://localhost:3000/api/v1/users/1
```

## Cache Statistics Explained

```json
{
  "hits": 15,           // Number of successful cache retrievals
  "misses": 8,          // Number of cache misses (not found or expired)
  "size": 3,            // Current number of entries in cache
  "capacity": 100,      // Maximum cache capacity
  "evictions": 2,       // Entries removed due to capacity limit
  "expirations": 5      // Entries removed due to TTL expiration
}
```

### Cache Hit Rate Calculation
```
Hit Rate = (hits / (hits + misses)) * 100%
Example: (15 / (15 + 8)) * 100% = 65.2%
```

## Advanced Testing Script

Create a test script to simulate real-world usage:

```bash
#!/bin/bash

echo "=== LRU Cache Test Suite ==="

echo -e "\n1. Testing Cache Miss (First Request)..."
curl -s http://localhost:3000/api/v1/users/1 | jq
sleep 1

echo -e "\n2. Testing Cache Hit (Second Request)..."
curl -s http://localhost:3000/api/v1/users/1 | jq
sleep 1

echo -e "\n3. Adding More Users..."
curl -s http://localhost:3000/api/v1/users/2 | jq
curl -s http://localhost:3000/api/v1/users/3 | jq
sleep 1

echo -e "\n4. Checking Cache Statistics..."
curl -s http://localhost:3000/api/v1/users/cache/stats | jq

echo -e "\n5. Testing LRU - Access user 1 again..."
curl -s http://localhost:3000/api/v1/users/1 | jq

echo -e "\n6. Final Cache Statistics..."
curl -s http://localhost:3000/api/v1/users/cache/stats | jq

echo -e "\n7. Testing Error Cases..."
echo "Non-existent user:"
curl -s http://localhost:3000/api/v1/users/999 | jq
echo "Invalid user ID:"
curl -s http://localhost:3000/api/v1/users/abc | jq

echo -e "\n=== Test Complete ==="
```

Save as `test-cache.sh`, make executable with `chmod +x test-cache.sh`, and run with `./test-cache.sh`.

## Monitoring Cache Performance

### Real-time Monitoring
```bash
# Watch cache stats every 2 seconds
watch -n 2 'curl -s http://localhost:3000/api/v1/users/cache/stats | jq'
```

### Calculate Hit Rate
```bash
curl -s http://localhost:3000/api/v1/users/cache/stats | \
  jq '{hit_rate: ((.hits / (.hits + .misses)) * 100), stats: .}'
```

## Architecture Highlights

### Data Structure
- **Doubly Linked List**: Maintains LRU order
- **Hash Map**: Provides O(1) lookups
- **Combined**: All operations are O(1)

### Cache Flow
```
Request → Check Cache → Hit? → Return (instant)
                     ↓
                    Miss
                     ↓
              Fetch from DB (200ms)
                     ↓
              Store in Cache
                     ↓
              Return Data
```

### Background Cleanup
```
Every 10 seconds:
  1. Scan all cache entries
  2. Check expiration (now - timestamp > 60s)
  3. Remove expired entries
  4. Log cleanup count
```

## Conclusion

This implementation provides:
- ✅ Production-ready LRU cache
- ✅ Automatic memory management
- ✅ Time-based expiration
- ✅ Comprehensive statistics
- ✅ Background cleanup
- ✅ Type-safe TypeScript code
- ✅ O(1) performance for all operations

Perfect for caching user data, API responses, or any frequently accessed data!

