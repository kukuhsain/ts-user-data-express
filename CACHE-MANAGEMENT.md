# Cache Management Features

## ✅ New Features Implemented

Two new endpoints have been added for manual cache management and comprehensive status monitoring:

1. ✅ **DELETE /api/v1/users/cache** - Clear entire cache
2. ✅ **GET /api/v1/users/cache-status** - Comprehensive cache and system status

## API Endpoints

### 1. Clear Cache (DELETE /api/v1/users/cache)

Manually clear the entire cache and reset response time statistics.

#### Request

```http
DELETE /api/v1/users/cache
```

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Cache cleared successfully",
  "timestamp": "2025-10-02T13:45:30.123Z"
}
```

#### Use Cases

- **Manual cache invalidation** - Clear stale data
- **Testing** - Reset cache between tests
- **Troubleshooting** - Force fresh data fetch
- **Deployment** - Clear cache after updates

#### Example

```bash
# Clear the cache
curl -X DELETE http://localhost:3000/api/v1/users/cache

# Response:
# {
#   "message": "Cache cleared successfully",
#   "timestamp": "2025-10-02T13:45:30.123Z"
# }
```

### 2. Cache Status (GET /api/v1/users/cache-status)

Get comprehensive status information including cache metrics, performance data, and queue statistics.

#### Request

```http
GET /api/v1/users/cache-status
```

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "cache": {
    "size": 3,
    "capacity": 100,
    "hits": 150,
    "misses": 25,
    "evictions": 0,
    "expirations": 5,
    "hitRate": "85.71%"
  },
  "performance": {
    "averageResponseTime": 45,
    "unit": "ms"
  },
  "queue": {
    "pending": 0,
    "processing": 1,
    "completed": 25,
    "failed": 0,
    "averageProcessingTime": 202
  },
  "timestamp": "2025-10-02T13:45:30.123Z"
}
```

#### Response Fields

##### Cache Section

| Field | Type | Description |
|-------|------|-------------|
| `size` | number | Current number of cached entries |
| `capacity` | number | Maximum cache capacity (100) |
| `hits` | number | Total cache hits |
| `misses` | number | Total cache misses |
| `evictions` | number | Entries removed due to capacity |
| `expirations` | number | Entries removed due to TTL |
| `hitRate` | string | Cache hit percentage |

##### Performance Section

| Field | Type | Description |
|-------|------|-------------|
| `averageResponseTime` | number | Average response time (ms) |
| `unit` | string | Time unit ("ms") |

##### Queue Section

| Field | Type | Description |
|-------|------|-------------|
| `pending` | number | Jobs waiting in queue |
| `processing` | number | Jobs currently processing |
| `completed` | number | Successfully completed jobs |
| `failed` | number | Failed jobs (after retries) |
| `averageProcessingTime` | number | Average processing time (ms) |

#### Example

```bash
# Get cache status
curl http://localhost:3000/api/v1/users/cache-status | jq

# Pretty formatted output
curl -s http://localhost:3000/api/v1/users/cache-status | jq '
  {
    cacheSize: .cache.size,
    hitRate: .cache.hitRate,
    avgResponseTime: "\(.performance.averageResponseTime)ms",
    queuePending: .queue.pending
  }
'
```

## Response Time Tracking

The system now tracks response times for all user requests:

- **Sample Size**: Last 100 requests
- **Calculation**: Rolling average
- **Includes**: Both cache hits and misses
- **Reset**: When cache is cleared

### Response Time Examples

**Cache Hit:**
```
Request → Cache lookup (1ms) → Response
Average: ~2-5ms
```

**Cache Miss:**
```
Request → Queue → Database (200ms) → Cache store → Response
Average: ~202-210ms
```

**Mixed Traffic (85% cache hit rate):**
```
Average: ~30-50ms
= (0.85 × 5ms) + (0.15 × 205ms)
```

## Testing

### Test 1: Clear Cache

```bash
echo "=== Testing Cache Clear ==="

# Make some requests to populate cache
for i in {1..3}; do
  curl -s http://localhost:3000/api/v1/users/$i > /dev/null
done

# Check cache status before clear
echo "Before clear:"
curl -s http://localhost:3000/api/v1/users/cache-status | jq '.cache.size'

# Clear cache
curl -X DELETE http://localhost:3000/api/v1/users/cache

# Check cache status after clear
echo "After clear:"
curl -s http://localhost:3000/api/v1/users/cache-status | jq '.cache.size'
```

**Expected Output:**
```
Before clear:
3

After clear:
0
```

### Test 2: Monitor Cache Status

```bash
echo "=== Monitoring Cache Status ==="

# Make various requests
for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/$((i % 3 + 1)) > /dev/null
done

# View comprehensive status
curl -s http://localhost:3000/api/v1/users/cache-status | jq
```

**Expected Output:**
```json
{
  "cache": {
    "size": 3,
    "capacity": 100,
    "hits": 7,
    "misses": 3,
    "evictions": 0,
    "expirations": 0,
    "hitRate": "70.00%"
  },
  "performance": {
    "averageResponseTime": 63,
    "unit": "ms"
  },
  "queue": {
    "pending": 0,
    "processing": 0,
    "completed": 3,
    "failed": 0,
    "averageProcessingTime": 202
  },
  "timestamp": "2025-10-02T13:45:30.123Z"
}
```

### Test 3: Response Time Tracking

```bash
#!/bin/bash

echo "=== Response Time Tracking Test ==="

# Clear cache first
curl -X DELETE http://localhost:3000/api/v1/users/cache > /dev/null 2>&1

echo "Making 5 requests (cache misses)..."
for i in {1..5}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null
done

status=$(curl -s http://localhost:3000/api/v1/users/cache-status)
miss_avg=$(echo $status | jq -r '.performance.averageResponseTime')
echo "Average response time (cache misses): ${miss_avg}ms"

echo -e "\nMaking 10 more requests (cache hits)..."
for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null
done

status=$(curl -s http://localhost:3000/api/v1/users/cache-status)
hit_avg=$(echo $status | jq -r '.performance.averageResponseTime')
echo "Average response time (mixed): ${hit_avg}ms"

echo -e "\nCache hit rate:"
echo $status | jq -r '.cache.hitRate'
```

**Expected Output:**
```
Average response time (cache misses): 205ms
Average response time (mixed): 70ms
Cache hit rate: 66.67%
```

### Test 4: Real-time Monitoring

```bash
# Terminal 1: Generate traffic
while true; do
  for i in {1..5}; do
    curl -s http://localhost:3000/api/v1/users/$((RANDOM % 3 + 1)) > /dev/null
  done
  sleep 2
done

# Terminal 2: Monitor status
watch -n 1 'curl -s http://localhost:3000/api/v1/users/cache-status | jq "{cacheSize: .cache.size, hitRate: .cache.hitRate, avgResponseTime: .performance.averageResponseTime, queuePending: .queue.pending}"'
```

## Use Cases

### 1. Performance Monitoring

```bash
# Create a monitoring script
cat > monitor-cache.sh << 'EOF'
#!/bin/bash
while true; do
  status=$(curl -s http://localhost:3000/api/v1/users/cache-status)
  
  hitRate=$(echo $status | jq -r '.cache.hitRate')
  avgTime=$(echo $status | jq -r '.performance.averageResponseTime')
  size=$(echo $status | jq -r '.cache.size')
  
  echo "[$(date +%T)] Cache: $size entries | Hit Rate: $hitRate | Avg Time: ${avgTime}ms"
  
  # Alert if hit rate drops below 70%
  hitRateNum=$(echo $hitRate | sed 's/%//')
  if (( $(echo "$hitRateNum < 70" | bc -l) )); then
    echo "⚠️  WARNING: Low cache hit rate!"
  fi
  
  sleep 5
done
EOF

chmod +x monitor-cache.sh
./monitor-cache.sh
```

### 2. Health Check Integration

```bash
# Health check script for monitoring systems
cat > health-check.sh << 'EOF'
#!/bin/bash
status=$(curl -s http://localhost:3000/api/v1/users/cache-status)

# Extract metrics
hitRate=$(echo $status | jq -r '.cache.hitRate' | sed 's/%//')
avgTime=$(echo $status | jq -r '.performance.averageResponseTime')
queuePending=$(echo $status | jq -r '.queue.pending')

# Health checks
healthy=true

if (( $(echo "$hitRate < 50" | bc -l) )); then
  echo "UNHEALTHY: Low cache hit rate ($hitRate%)"
  healthy=false
fi

if (( avgTime > 500 )); then
  echo "UNHEALTHY: High response time (${avgTime}ms)"
  healthy=false
fi

if (( queuePending > 20 )); then
  echo "UNHEALTHY: High queue backlog ($queuePending)"
  healthy=false
fi

if [ "$healthy" = true ]; then
  echo "HEALTHY: All metrics normal"
  exit 0
else
  exit 1
fi
EOF

chmod +x health-check.sh
./health-check.sh
```

### 3. Automated Cache Management

```bash
# Auto-clear cache if hit rate drops too low
cat > auto-manage-cache.sh << 'EOF'
#!/bin/bash
while true; do
  status=$(curl -s http://localhost:3000/api/v1/users/cache-status)
  hitRate=$(echo $status | jq -r '.cache.hitRate' | sed 's/%//')
  
  # If hit rate below 30%, clear and rebuild
  if (( $(echo "$hitRate < 30 && $hitRate > 0" | bc -l) )); then
    echo "[$(date +%T)] Low hit rate detected ($hitRate%). Clearing cache..."
    curl -X DELETE http://localhost:3000/api/v1/users/cache
    
    # Warm up cache with common entries
    for i in {1..3}; do
      curl -s http://localhost:3000/api/v1/users/$i > /dev/null
    done
  fi
  
  sleep 60
done
EOF

chmod +x auto-manage-cache.sh
./auto-manage-cache.sh
```

## Monitoring Dashboard Example

Create a simple monitoring dashboard:

```bash
#!/bin/bash

clear
echo "╔════════════════════════════════════════════════════╗"
echo "║         Cache Monitoring Dashboard                 ║"
echo "╚════════════════════════════════════════════════════╝"

while true; do
  status=$(curl -s http://localhost:3000/api/v1/users/cache-status)
  
  # Extract all metrics
  size=$(echo $status | jq -r '.cache.size')
  capacity=$(echo $status | jq -r '.cache.capacity')
  hits=$(echo $status | jq -r '.cache.hits')
  misses=$(echo $status | jq -r '.cache.misses')
  hitRate=$(echo $status | jq -r '.cache.hitRate')
  avgTime=$(echo $status | jq -r '.performance.averageResponseTime')
  queuePending=$(echo $status | jq -r '.queue.pending')
  queueProcessing=$(echo $status | jq -r '.queue.processing')
  
  # Display dashboard
  tput cup 3 0
  echo "┌─ Cache Metrics ──────────────────────────────────┐"
  echo "│ Size:         $size / $capacity entries                │"
  echo "│ Hit Rate:     $hitRate                          │"
  echo "│ Hits:         $hits                              │"
  echo "│ Misses:       $misses                            │"
  echo "└──────────────────────────────────────────────────┘"
  echo ""
  echo "┌─ Performance ────────────────────────────────────┐"
  echo "│ Avg Response: ${avgTime}ms                       │"
  echo "└──────────────────────────────────────────────────┘"
  echo ""
  echo "┌─ Queue Status ───────────────────────────────────┐"
  echo "│ Pending:      $queuePending                      │"
  echo "│ Processing:   $queueProcessing                   │"
  echo "└──────────────────────────────────────────────────┘"
  echo ""
  echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "Press Ctrl+C to exit"
  
  sleep 2
done
```

## Integration with Existing Endpoints

### Complete API Overview

```
Users API:
├── GET    /api/v1/users/:id           - Get user by ID
├── GET    /api/v1/users/cache/stats   - Cache statistics
├── GET    /api/v1/users/queue/stats   - Queue statistics
├── GET    /api/v1/users/cache-status  - ⭐ NEW: Comprehensive status
└── DELETE /api/v1/users/cache         - ⭐ NEW: Clear cache
```

### Workflow Example

```bash
# 1. Check current status
curl http://localhost:3000/api/v1/users/cache-status | jq

# 2. Make some requests
for i in {1..10}; do
  curl -s http://localhost:3000/api/v1/users/$((i % 3 + 1)) > /dev/null
done

# 3. Check updated status
curl http://localhost:3000/api/v1/users/cache-status | jq

# 4. Clear cache if needed
curl -X DELETE http://localhost:3000/api/v1/users/cache

# 5. Verify cache cleared
curl http://localhost:3000/api/v1/users/cache-status | jq '.cache.size'
```

## Best Practices

### 1. Regular Monitoring

```bash
# Set up a cron job to log cache metrics
*/5 * * * * curl -s http://localhost:3000/api/v1/users/cache-status >> /var/log/cache-metrics.log
```

### 2. Alert on Anomalies

```bash
# Alert if hit rate drops below threshold
hitRate=$(curl -s http://localhost:3000/api/v1/users/cache-status | jq -r '.cache.hitRate' | sed 's/%//')
if (( $(echo "$hitRate < 60" | bc -l) )); then
  # Send alert (email, Slack, etc.)
  echo "Alert: Low cache hit rate: $hitRate%" | mail -s "Cache Alert" admin@example.com
fi
```

### 3. Proactive Cache Management

```bash
# Clear cache during low-traffic periods
if [ $(date +%H) -eq 3 ]; then  # 3 AM
  curl -X DELETE http://localhost:3000/api/v1/users/cache
  echo "Cache cleared during maintenance window"
fi
```

### 4. Performance Baseline

```bash
# Establish performance baseline
for i in {1..100}; do
  curl -s http://localhost:3000/api/v1/users/$((RANDOM % 3 + 1)) > /dev/null
done

baseline=$(curl -s http://localhost:3000/api/v1/users/cache-status | jq -r '.performance.averageResponseTime')
echo "Performance baseline: ${baseline}ms" > baseline.txt
```

## Troubleshooting

### Low Cache Hit Rate

**Symptom:** `hitRate < 50%`

**Possible Causes:**
1. Accessing too many different users
2. Cache TTL too short
3. Cache cleared too frequently

**Solutions:**
- Increase cache capacity
- Increase TTL
- Analyze access patterns

### High Response Time

**Symptom:** `averageResponseTime > 100ms`

**Possible Causes:**
1. Low cache hit rate
2. Database slow
3. Queue backlog

**Solutions:**
- Improve cache hit rate
- Optimize database queries
- Increase queue concurrency

### Cache Not Clearing

**Check endpoint:**
```bash
curl -X DELETE http://localhost:3000/api/v1/users/cache
curl http://localhost:3000/api/v1/users/cache-status | jq '.cache.size'
```

Should return `0` after clearing.

## Summary

✅ **Manual Cache Management** - Clear cache on demand
✅ **Comprehensive Status** - Monitor cache, performance, and queue
✅ **Response Time Tracking** - Track average response times
✅ **Hit Rate Calculation** - Automatic cache efficiency metric
✅ **Unified Dashboard** - Single endpoint for all metrics
✅ **Production Ready** - Suitable for monitoring and alerting

The new cache management endpoints provide complete visibility and control over the caching system! 🎯

