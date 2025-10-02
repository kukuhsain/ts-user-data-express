# API Quick Reference

## 🚀 All Endpoints

### Users API (`/api/v1/users`)

| Method | Endpoint | Description | Rate Limited |
|--------|----------|-------------|--------------|
| GET | `/:id` | Get user by ID | ✅ Yes |
| GET | `/cache/stats` | Cache statistics | ✅ Yes |
| GET | `/queue/stats` | Queue statistics | ✅ Yes |
| GET | `/cache-status` | Comprehensive status | ✅ Yes |
| DELETE | `/cache` | Clear cache | ✅ Yes |

## 📋 Common Commands

### Get User
```bash
curl http://localhost:3000/api/v1/users/1
```

### Check Comprehensive Status
```bash
curl http://localhost:3000/api/v1/users/cache-status | jq
```

### Clear Cache
```bash
curl -X DELETE http://localhost:3000/api/v1/users/cache
```

### Monitor in Real-time
```bash
watch -n 1 'curl -s http://localhost:3000/api/v1/users/cache-status | jq'
```

## 📊 Response Examples

### User Response
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Cache Status Response
```json
{
  "cache": {
    "size": 3,
    "capacity": 100,
    "hits": 150,
    "misses": 25,
    "hitRate": "85.71%"
  },
  "performance": {
    "averageResponseTime": 45,
    "unit": "ms"
  },
  "queue": {
    "pending": 0,
    "processing": 1,
    "completed": 175
  },
  "timestamp": "2025-10-02T13:45:30.123Z"
}
```

### Rate Limit Headers
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Burst-Limit: 5
X-RateLimit-Burst-Remaining: 3
```

## 🎯 System Configuration

### Cache
- **Type**: LRU (Least Recently Used)
- **Capacity**: 100 entries
- **TTL**: 60 seconds
- **Cleanup**: Every 10 seconds

### Rate Limiter
- **Main Window**: 10 requests/minute
- **Burst Window**: 5 requests/10 seconds
- **Algorithm**: Sliding window
- **Error Code**: 429

### Queue
- **Concurrency**: 5 simultaneous jobs
- **Max Retries**: 3 attempts
- **Retry Delay**: 1 second
- **Deduplication**: Enabled

## 📈 Performance Targets

| Metric | Target | Typical |
|--------|--------|---------|
| Cache Hit Rate | > 80% | ~85% |
| Avg Response (hit) | < 10ms | ~5ms |
| Avg Response (miss) | ~200ms | ~205ms |
| Queue Pending | < 10 | 0-2 |

## 🔧 Troubleshooting

### Low Hit Rate
```bash
# Check status
curl http://localhost:3000/api/v1/users/cache-status | jq '.cache.hitRate'

# Clear and rebuild
curl -X DELETE http://localhost:3000/api/v1/users/cache
```

### High Response Time
```bash
# Check performance
curl http://localhost:3000/api/v1/users/cache-status | jq '.performance'
```

### Queue Backlog
```bash
# Check queue
curl http://localhost:3000/api/v1/users/cache-status | jq '.queue.pending'
```

## 📚 Documentation Links

- **Complete Summary**: `FINAL-SUMMARY.md`
- **Cache Management**: `CACHE-MANAGEMENT.md`
- **Testing Guides**: `demo-*.md` files
- **Technical Docs**: `src/*/README.md` files

## 🎯 Quick Tests

### Test All Features
```bash
# User endpoint
curl http://localhost:3000/api/v1/users/1

# Cache status
curl http://localhost:3000/api/v1/users/cache-status

# Clear cache
curl -X DELETE http://localhost:3000/api/v1/users/cache

# Verify cleared
curl http://localhost:3000/api/v1/users/cache-status | jq '.cache.size'
```

### Test Rate Limiting
```bash
# 6 rapid requests (6th should fail)
for i in {1..6}; do curl -w "%{http_code}\n" http://localhost:3000/api/v1/users/1; done
```

### Test Performance
```bash
# Cold cache
time curl http://localhost:3000/api/v1/users/1

# Warm cache (instant)
time curl http://localhost:3000/api/v1/users/1
```

## 🚀 Start Commands

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start

# Tests
pnpm test

# Linting
pnpm lint
```

---

**Need more details?** See `FINAL-SUMMARY.md` for complete documentation.

