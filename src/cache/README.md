# Advanced LRU Cache Implementation

## Overview

This module implements an advanced **Least Recently Used (LRU) Cache** with the following features:

- ✅ **LRU Eviction Strategy**: Automatically removes least recently used items when capacity is reached
- ✅ **Time-based Expiration**: Cache entries expire after 60 seconds (configurable TTL)
- ✅ **Cache Statistics**: Tracks hits, misses, evictions, expirations, and current size
- ✅ **Automatic Cleanup**: Background task runs every 10 seconds to remove expired entries
- ✅ **Type-Safe**: Fully typed with TypeScript generics

## Architecture

### Data Structure

The cache uses a **doubly-linked list** combined with a **hash map** for O(1) operations:

```
Hash Map: key -> Node
Doubly Linked List: [HEAD] <-> Node1 <-> Node2 <-> ... <-> NodeN <-> [TAIL]
                     (MRU)                                            (LRU)
```

- **Most Recently Used (MRU)**: Head of the list
- **Least Recently Used (LRU)**: Tail of the list

### Key Components

1. **CacheNode**: Individual cache entry with key, value, timestamp, and pointers
2. **LRUCache**: Main cache class with get/set operations and statistics
3. **Background Cleanup**: Periodic task to remove expired entries

## Usage

### Basic Usage

```typescript
import LRUCache from "./cache/lru-cache.js";

// Create cache: capacity=100, TTL=60 seconds
const cache = new LRUCache<User>(100, 60);

// Set value
cache.set("user:1", { id: 1, name: "John", email: "john@example.com" });

// Get value
const user = cache.get("user:1"); // Returns user or null

// Get statistics
const stats = cache.getStats();
console.log(stats);
// {
//   hits: 10,
//   misses: 5,
//   size: 3,
//   capacity: 100,
//   evictions: 0,
//   expirations: 2
// }
```

### Configuration

```typescript
// Default: capacity=100, TTL=60 seconds
const cache = new LRUCache<T>();

// Custom capacity and TTL
const cache = new LRUCache<T>(50, 120); // 50 items, 120 seconds
```

## Cache Operations

### Time Complexity

| Operation         | Time Complexity | Description                      |
| ----------------- | --------------- | -------------------------------- |
| `get(key)`        | O(1)            | Retrieve value and move to front |
| `set(key, value)` | O(1)            | Insert/update value              |
| `remove(key)`     | O(1)            | Remove specific entry            |
| `clear()`         | O(n)            | Clear all entries                |
| `getStats()`      | O(1)            | Get cache statistics             |

### Cache Behavior

1. **Cache Hit**: Entry exists and not expired → moved to front (MRU)
2. **Cache Miss**: Entry doesn't exist or expired → increment miss counter
3. **Capacity Reached**: Remove LRU entry (tail) → increment eviction counter
4. **TTL Expired**: Entry older than TTL → increment expiration counter

## Statistics

The cache tracks comprehensive statistics:

```typescript
type CacheStats = {
  hits: number; // Successful cache retrievals
  misses: number; // Failed cache retrievals
  size: number; // Current number of entries
  capacity: number; // Maximum capacity
  evictions: number; // Entries removed due to capacity
  expirations: number; // Entries removed due to TTL
};
```

## Background Cleanup

The cache automatically runs a cleanup task every 10 seconds to remove expired entries:

```typescript
// Cleanup runs automatically
// You can manually stop it:
cache.stopCleanupTask();

// Clean up resources
cache.destroy(); // Stops cleanup and clears cache
```

## Performance Characteristics

### Memory Usage

- **Per Entry**: ~80-100 bytes (depends on value size)
- **Cache Overhead**: O(n) where n = number of entries
- **Maximum Memory**: capacity × average_entry_size

### CPU Usage

- **Get/Set Operations**: Minimal (O(1))
- **Cleanup Task**: Runs every 10 seconds, O(n) scan
- **Impact**: Negligible for caches under 10,000 entries

## Best Practices

1. **Choose Appropriate Capacity**: Balance memory usage vs cache hit rate
2. **Set Reasonable TTL**: Consider data freshness requirements
3. **Monitor Statistics**: Use stats to optimize cache configuration
4. **Cleanup on Exit**: Call `destroy()` to prevent memory leaks

## Example: User Cache

```typescript
// 100 users max, 60 second expiration
const userCache = new LRUCache<User>(100, 60);

async function getUser(userId: number): Promise<User> {
  const cacheKey = `user:${userId}`;

  // Try cache first
  const cached = userCache.get(cacheKey);
  if (cached) {
    console.log("Cache hit!");
    return cached;
  }

  // Cache miss - fetch from database
  console.log("Cache miss - fetching from DB");
  const user = await fetchUserFromDatabase(userId);

  // Store in cache
  userCache.set(cacheKey, user);

  return user;
}

// Monitor cache performance
setInterval(() => {
  const stats = userCache.getStats();
  const hitRate = (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2);
  console.log(`Cache hit rate: ${hitRate}%`);
}, 60000);
```

## Testing Cache Behavior

```bash
# Test 1: Cache miss (first request) - takes ~200ms
curl http://localhost:3000/api/v1/users/1

# Test 2: Cache hit (immediate) - instant response
curl http://localhost:3000/api/v1/users/1

# Test 3: View cache statistics
curl http://localhost:3000/api/v1/users/cache/stats

# Test 4: Wait 61 seconds and request again - cache miss (expired)
sleep 61
curl http://localhost:3000/api/v1/users/1
```

## Advantages Over Simple Object Cache

| Feature           | Simple Object | LRU Cache          |
| ----------------- | ------------- | ------------------ |
| Memory Management | ❌ No limit   | ✅ Capacity-based  |
| Eviction Strategy | ❌ None       | ✅ LRU algorithm   |
| TTL Support       | ❌ Manual     | ✅ Automatic       |
| Statistics        | ❌ None       | ✅ Comprehensive   |
| Auto Cleanup      | ❌ No         | ✅ Background task |
| Time Complexity   | O(1)          | O(1)               |

## Implementation Details

### Why Doubly-Linked List?

- Allows O(1) removal from any position
- O(1) insertion at head (MRU position)
- O(1) removal from tail (LRU position)

### Why Combined with Hash Map?

- Hash map provides O(1) lookup by key
- Linked list provides O(1) reordering (MRU/LRU)
- Together: All operations are O(1)

### TTL Implementation

Each node stores a timestamp. On access:

1. Check if `now - timestamp > TTL`
2. If expired: remove entry and return null
3. Background task scans all entries every 10 seconds

## License

Part of the ts-user-data-express project.
