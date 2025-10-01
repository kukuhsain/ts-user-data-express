# Rate Limiter Middleware

## Overview

A sophisticated rate-limiting middleware with burst traffic handling capabilities. Uses a sliding window algorithm for accurate rate limiting.

## Features

✅ **Sliding Window Algorithm** - Accurate rate limiting with no edge cases
✅ **Burst Traffic Handling** - Separate burst capacity for short-term spikes
✅ **Per-IP Tracking** - Automatic IP-based rate limiting
✅ **Automatic Cleanup** - Background task removes old entries
✅ **Rate Limit Headers** - Standard HTTP headers for client information
✅ **Configurable** - Flexible configuration for different use cases

## Configuration

### Default Configuration (Users API)

```typescript
// 10 requests per minute, 5 requests per 10 seconds burst
const rateLimiter = createRateLimiter(
  60 * 1000, // 1 minute window
  10, // 10 requests per minute
  10 * 1000, // 10 second burst window
  5 // 5 requests per burst window
);
```

### Custom Configuration

```typescript
import RateLimiter from "./middleware/rate-limiter.js";

const limiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  burstWindowMs: 10 * 1000, // 10 seconds
  burstMaxRequests: 5, // 5 requests per 10 seconds
  keyGenerator: (req) => { // Optional: custom key generator
    return req.headers["x-api-key"] || req.ip;
  }
});

// Apply to routes
router.use(limiter.middleware());
```

## How It Works

### Sliding Window Algorithm

Instead of fixed time windows, the rate limiter uses a sliding window that moves with each request:

```
Fixed Window (inaccurate):
[----60s----][----60s----]
     ↑            ↑
  Can reset    Can reset
  at boundary  at boundary

Sliding Window (accurate):
[----60s moving window----]
         ↑
    Moves with each request
```

### Dual Window System

1. **Main Window**: 10 requests per 60 seconds
2. **Burst Window**: 5 requests per 10 seconds

Both windows are checked on each request. The request is denied if either limit is exceeded.

### Request Flow

```
┌──────────────────────────────────────────────────────┐
│              Incoming Request                         │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  Extract Key (IP)    │
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  Clean Old Entries   │
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  Check Burst Window  │
           │   (5 req/10s)        │
           └──────────┬───────────┘
                      │
              ┌───────┴───────┐
              │               │
              ▼               ▼
         Exceeded         OK
              │               │
              │               ▼
              │    ┌──────────────────────┐
              │    │  Check Main Window   │
              │    │   (10 req/60s)       │
              │    └──────────┬───────────┘
              │               │
              │       ┌───────┴───────┐
              │       │               │
              ▼       ▼               ▼
         ┌─────────────────┐    ┌──────────────────┐
         │  Return 429     │    │ Record Request   │
         │  Too Many       │    │ Add Headers      │
         │  Requests       │    │ Continue         │
         └─────────────────┘    └──────────────────┘
```

## Response Format

### Success Response (< Rate Limit)

The middleware adds rate limit headers to successful requests:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Burst-Limit: 5
X-RateLimit-Burst-Remaining: 3
```

### Rate Limit Exceeded (429)

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "message": "Burst limit exceeded. Maximum 5 requests per 10 seconds.",
  "retryAfter": 8
}
```

**or**

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "message": "Rate limit exceeded. Maximum 10 requests per 60 seconds.",
  "retryAfter": 45
}
```

## Rate Limit Headers

| Header                        | Description                             |
| ----------------------------- | --------------------------------------- |
| `X-RateLimit-Limit`           | Maximum requests allowed in main window |
| `X-RateLimit-Remaining`       | Remaining requests in main window       |
| `X-RateLimit-Burst-Limit`     | Maximum requests in burst window        |
| `X-RateLimit-Burst-Remaining` | Remaining requests in burst window      |

## Testing

### Test 1: Normal Usage (Within Limits)

```bash
# Make 3 requests - all should succeed
for i in {1..3}; do
  curl -i http://localhost:3000/api/v1/users/1
  echo "Request $i completed"
done
```

**Expected**: All requests return 200 OK

### Test 2: Burst Limit (5 requests in 10 seconds)

```bash
# Make 6 rapid requests - 6th should be rate limited
for i in {1..6}; do
  curl -i http://localhost:3000/api/v1/users/1
  echo "Request $i completed"
done
```

**Expected**:

- Requests 1-5: 200 OK
- Request 6: 429 Too Many Requests

### Test 3: Main Limit (10 requests per minute)

```bash
# Make 11 requests with 2 second gaps (avoids burst limit)
for i in {1..11}; do
  curl -i http://localhost:3000/api/v1/users/1
  echo "Request $i completed"
  sleep 2
done
```

**Expected**:

- Requests 1-10: 200 OK
- Request 11: 429 Too Many Requests

### Test 4: Rate Limit Recovery

```bash
# Trigger burst limit
for i in {1..6}; do
  curl -i http://localhost:3000/api/v1/users/1
done

# Wait 11 seconds for burst window to reset
sleep 11

# Should work again
curl -i http://localhost:3000/api/v1/users/1
```

**Expected**: Last request returns 200 OK

### Test 5: Check Rate Limit Headers

```bash
curl -i http://localhost:3000/api/v1/users/1 | grep "X-RateLimit"
```

**Expected Output**:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Burst-Limit: 5
X-RateLimit-Burst-Remaining: 4
```

## Advanced Testing Script

```bash
#!/bin/bash

echo "=== Rate Limiter Test Suite ==="

echo -e "\n1. Testing Normal Usage (3 requests)..."
for i in {1..3}; do
  response=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/v1/users/1)
  http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
  echo "Request $i: HTTP $http_code"
done

echo -e "\n2. Testing Burst Limit (6 rapid requests)..."
for i in {1..6}; do
  response=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/v1/users/1)
  http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
  echo "Request $i: HTTP $http_code"
  if [ "$http_code" = "429" ]; then
    echo "✓ Burst limit triggered at request $i"
    break
  fi
done

echo -e "\n3. Waiting 11 seconds for burst window reset..."
sleep 11

echo -e "\n4. Testing recovery..."
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/v1/users/1)
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
echo "Recovery request: HTTP $http_code"

echo -e "\n5. Checking rate limit headers..."
curl -s -i http://localhost:3000/api/v1/users/1 | grep "X-RateLimit"

echo -e "\n=== Test Complete ==="
```

Save as `test-rate-limit.sh`, make executable with `chmod +x test-rate-limit.sh`, and run.

## Architecture Details

### Data Structure

```typescript
// Per-IP tracking
store: Map<IP, Window>;

// Window structure
type Window = {
  requests: number[]; // Timestamps of all requests in main window
  burstRequests: number[]; // Timestamps of requests in burst window
};
```

### Memory Management

- **Automatic Cleanup**: Background task runs every 30 seconds
- **On-Access Cleanup**: Old timestamps removed on each request
- **Empty Window Removal**: IPs with no recent requests are deleted

### Performance

- **Time Complexity**: O(n) where n = requests in window (typically < 10)
- **Space Complexity**: O(m × n) where m = unique IPs, n = max requests
- **Memory Usage**: ~1KB per active IP (with full windows)

## Use Cases

### API Protection

```typescript
// Protect public APIs
router.use("/api/public", createRateLimiter(
  60 * 1000, // 1 minute
  100, // 100 requests per minute
  5 * 1000, // 5 seconds
  20 // 20 burst requests
));
```

### Authentication Endpoints

```typescript
// Strict limits on auth endpoints
router.use("/auth/login", createRateLimiter(
  60 * 1000, // 1 minute
  5, // 5 attempts per minute
  60 * 1000, // No burst (same as main)
  5 // Same as main
));
```

### User-Specific Limits

```typescript
// Rate limit by user ID instead of IP
const userLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  burstWindowMs: 10 * 1000,
  burstMaxRequests: 20,
  keyGenerator: (req) => {
    return req.user?.id || req.ip; // User ID if authenticated
  }
});
```

## Monitoring

### Get Rate Limit Info

```typescript
const limiter = new RateLimiter({ /* config */ });

// Get info for specific key
const info = limiter.getRateLimitInfo("192.168.1.1");
console.log(info);
// {
//   requestsInWindow: 7,
//   burstRequestsInWindow: 3,
//   remainingRequests: 3,
//   remainingBurstRequests: 2
// }

// Get store size (number of tracked IPs)
console.log(`Tracking ${limiter.getStoreSize()} IPs`);
```

## Best Practices

1. **Choose Appropriate Limits**: Balance user experience with server protection
2. **Monitor 429 Responses**: High rates may indicate DoS or misconfigured clients
3. **Provide Retry-After**: Help clients implement proper backoff strategies
4. **Use Different Limits**: Apply stricter limits to expensive endpoints
5. **Consider User Tiers**: Authenticated users may get higher limits

## Advantages Over Simple Rate Limiters

| Feature         | Simple Counter                | This Implementation      |
| --------------- | ----------------------------- | ------------------------ |
| Accuracy        | ❌ Fixed windows (edge cases) | ✅ Sliding window        |
| Burst Handling  | ❌ No burst support           | ✅ Dual window system    |
| Headers         | ❌ Limited info               | ✅ Comprehensive headers |
| Cleanup         | ❌ Manual                     | ✅ Automatic             |
| Flexibility     | ❌ Basic config               | ✅ Highly configurable   |
| Time Complexity | O(1)                          | O(n) - small n           |

## Configuration Examples

### Strict (Authentication)

```typescript
createRateLimiter(60000, 3, 60000, 3);
// 3 requests per minute, no burst
```

### Moderate (User API)

```typescript
createRateLimiter(60000, 10, 10000, 5);
// 10/min, 5/10s burst (current implementation)
```

### Lenient (Public API)

```typescript
createRateLimiter(60000, 100, 10000, 20);
// 100/min, 20/10s burst
```

### Very Strict (Password Reset)

```typescript
createRateLimiter(3600000, 3, 3600000, 3);
// 3 requests per hour, no burst
```

## Troubleshooting

### Issue: Legitimate Users Getting Rate Limited

**Solution**: Increase limits or implement authenticated user exemptions

```typescript
keyGenerator: (req) => {
  if (req.user?.premium) {
    return `premium:${req.user.id}`; // Higher limits for premium
  }
  return req.ip;
};
```

### Issue: High Memory Usage

**Solution**: Reduce cleanup interval or window sizes

```typescript
// More aggressive cleanup
private startCleanupTask(): void {
  this.cleanupInterval = setInterval(() => {
    // cleanup logic
  }, 10000); // Every 10 seconds instead of 30
}
```

### Issue: Behind Proxy/Load Balancer

**Solution**: Trust proxy headers

```typescript
// In app.ts
app.set("trust proxy", 1);

// Custom key generator
keyGenerator: (req) => {
  return req.headers["x-forwarded-for"] || req.ip;
};
```

## License

Part of the ts-user-data-express project.
