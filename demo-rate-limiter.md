# Rate Limiter Testing Guide

## ✅ Implementation Complete

Sophisticated rate limiting with burst traffic handling has been implemented:

- ✅ **10 requests per minute** (main window)
- ✅ **5 requests per 10 seconds** (burst window)
- ✅ **429 status code** with meaningful messages
- ✅ **Sliding window algorithm** for accuracy
- ✅ **Rate limit headers** for client information
- ✅ **Automatic cleanup** of old entries

## Quick Start

### 1. Start the Server

```bash
pnpm start
```

### 2. Test Normal Request

```bash
curl -i http://localhost:3000/api/v1/users/1
```

**Expected Response:**
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Burst-Limit: 5
X-RateLimit-Burst-Remaining: 4

{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

## Test Scenarios

### Scenario 1: Burst Limit Test

**Goal**: Trigger the 5 requests per 10 seconds limit

```bash
# Make 6 rapid requests
for i in {1..6}; do
  echo "Request $i:"
  curl -i http://localhost:3000/api/v1/users/1 2>&1 | head -20
  echo ""
done
```

**Expected Results:**

**Requests 1-5**: ✅ 200 OK
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Burst-Limit: 5
X-RateLimit-Burst-Remaining: 4
```

**Request 6**: ❌ 429 Too Many Requests
```http
HTTP/1.1 429 Too Many Requests

{
  "message": "Burst limit exceeded. Maximum 5 requests per 10 seconds.",
  "retryAfter": 9
}
```

### Scenario 2: Main Window Limit Test

**Goal**: Trigger the 10 requests per minute limit (without hitting burst limit)

```bash
# Make 11 requests with 2-second gaps
for i in {1..11}; do
  echo "Request $i:"
  curl -s -w "HTTP %{http_code}\n" http://localhost:3000/api/v1/users/1
  sleep 2
done
```

**Expected Results:**
- Requests 1-10: `HTTP 200`
- Request 11: `HTTP 429`

```json
{
  "message": "Rate limit exceeded. Maximum 10 requests per 60 seconds.",
  "retryAfter": 50
}
```

### Scenario 3: Rate Limit Recovery

**Goal**: Verify that limits reset after the window expires

```bash
# Part 1: Trigger burst limit
echo "=== Triggering Burst Limit ==="
for i in {1..6}; do
  response=$(curl -s -w "\nHTTP:%{http_code}" http://localhost:3000/api/v1/users/1)
  code=$(echo "$response" | tail -1 | cut -d: -f2)
  echo "Request $i: HTTP $code"
done

# Part 2: Wait for burst window to reset (11 seconds)
echo ""
echo "=== Waiting 11 seconds for burst window reset ==="
for i in {10..1}; do
  echo -ne "Waiting... $i seconds remaining\r"
  sleep 1
done
echo ""

# Part 3: Try again - should work
echo "=== Testing Recovery ==="
response=$(curl -s -w "\nHTTP:%{http_code}" http://localhost:3000/api/v1/users/1)
code=$(echo "$response" | tail -1 | cut -d: -f2)
echo "Recovery request: HTTP $code"

if [ "$code" = "200" ]; then
  echo "✅ Rate limit successfully reset!"
else
  echo "❌ Rate limit did not reset"
fi
```

### Scenario 4: Rate Limit Headers Inspection

**Goal**: Examine rate limit headers to track remaining requests

```bash
# Make request and show only headers
echo "=== Rate Limit Headers ==="
curl -s -i http://localhost:3000/api/v1/users/1 | grep -E "(HTTP|X-RateLimit)"

# Make 3 more requests and watch counters decrease
for i in {1..3}; do
  echo -e "\n=== After Request $((i+1)) ==="
  curl -s -i http://localhost:3000/api/v1/users/1 | grep -E "X-RateLimit"
done
```

**Expected Output:**
```
=== Rate Limit Headers ===
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Burst-Limit: 5
X-RateLimit-Burst-Remaining: 4

=== After Request 2 ===
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Burst-Limit: 5
X-RateLimit-Burst-Remaining: 3

... and so on
```

### Scenario 5: Retry-After Header Test

**Goal**: Test that retry-after values are accurate

```bash
echo "=== Testing Retry-After ==="

# Trigger burst limit
for i in {1..6}; do
  curl -s http://localhost:3000/api/v1/users/1 > /dev/null
done

# Get retry-after value
retry_after=$(curl -s http://localhost:3000/api/v1/users/1 | jq -r '.retryAfter')
echo "Server says to retry after: $retry_after seconds"

# Wait for that amount
echo "Waiting $retry_after seconds..."
sleep $retry_after

# Try again
echo "Attempting request after waiting..."
response=$(curl -s -w "\nHTTP:%{http_code}" http://localhost:3000/api/v1/users/1)
code=$(echo "$response" | tail -1 | cut -d: -f2)

if [ "$code" = "200" ]; then
  echo "✅ Request succeeded after retry-after period"
else
  echo "❌ Request still rate limited (HTTP $code)"
fi
```

### Scenario 6: Multiple IPs Test

**Goal**: Verify that different IPs have separate rate limits

```bash
# Request from default IP
echo "=== Request from default IP ==="
curl -s -w "HTTP %{http_code}\n" http://localhost:3000/api/v1/users/1

# Request with different X-Forwarded-For header (if proxy trust is enabled)
echo "=== Request from different IP ==="
curl -s -w "HTTP %{http_code}\n" \
  -H "X-Forwarded-For: 192.168.1.100" \
  http://localhost:3000/api/v1/users/1
```

**Note**: This only works if `app.set('trust proxy', 1)` is configured.

## Comprehensive Test Script

Save this as `test-rate-limit.sh`:

```bash
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Rate Limiter Comprehensive Test"
echo "========================================"

# Test 1: Burst Limit
echo -e "\n${YELLOW}Test 1: Burst Limit (5 requests/10s)${NC}"
echo "Making 6 rapid requests..."
burst_success=0
burst_limited=0
for i in {1..6}; do
  code=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000/api/v1/users/1)
  if [ "$code" = "200" ]; then
    burst_success=$((burst_success + 1))
    echo -e "  Request $i: ${GREEN}$code OK${NC}"
  else
    burst_limited=$((burst_limited + 1))
    echo -e "  Request $i: ${RED}$code RATE LIMITED${NC}"
  fi
done

if [ $burst_success -eq 5 ] && [ $burst_limited -eq 1 ]; then
  echo -e "${GREEN}✓ Burst limit working correctly${NC}"
else
  echo -e "${RED}✗ Burst limit test failed${NC}"
fi

# Wait for burst window to reset
echo -e "\n${YELLOW}Waiting 11 seconds for burst window reset...${NC}"
sleep 11

# Test 2: Main Window Limit
echo -e "\n${YELLOW}Test 2: Main Window Limit (10 requests/minute)${NC}"
echo "Making 11 requests with 2s gaps..."
main_success=0
main_limited=0
for i in {1..11}; do
  code=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000/api/v1/users/1)
  if [ "$code" = "200" ]; then
    main_success=$((main_success + 1))
    echo -e "  Request $i: ${GREEN}$code OK${NC}"
  else
    main_limited=$((main_limited + 1))
    echo -e "  Request $i: ${RED}$code RATE LIMITED${NC}"
  fi
  
  # Sleep to avoid burst limit (except last request)
  if [ $i -lt 11 ]; then
    sleep 2
  fi
done

if [ $main_success -eq 10 ] && [ $main_limited -eq 1 ]; then
  echo -e "${GREEN}✓ Main window limit working correctly${NC}"
else
  echo -e "${RED}✗ Main window limit test failed${NC}"
fi

# Test 3: Rate Limit Headers
echo -e "\n${YELLOW}Test 3: Rate Limit Headers${NC}"
sleep 60 # Wait for rate limit to reset

headers=$(curl -s -i http://localhost:3000/api/v1/users/1 | grep -E "X-RateLimit")
if echo "$headers" | grep -q "X-RateLimit-Limit: 10"; then
  echo -e "${GREEN}✓ Rate limit headers present${NC}"
  echo "$headers" | sed 's/^/  /'
else
  echo -e "${RED}✗ Rate limit headers missing${NC}"
fi

# Test 4: Error Message Quality
echo -e "\n${YELLOW}Test 4: Error Message Quality${NC}"
# Trigger rate limit
for i in {1..6}; do
  curl -s -o /dev/null http://localhost:3000/api/v1/users/1
done

response=$(curl -s http://localhost:3000/api/v1/users/1)
if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
  message=$(echo "$response" | jq -r '.message')
  retry_after=$(echo "$response" | jq -r '.retryAfter')
  echo -e "${GREEN}✓ Error response structured correctly${NC}"
  echo "  Message: $message"
  echo "  Retry After: $retry_after seconds"
else
  echo -e "${RED}✗ Error response malformed${NC}"
fi

# Summary
echo -e "\n========================================"
echo -e "         ${GREEN}Test Suite Complete${NC}"
echo -e "========================================\n"
```

Make it executable and run:

```bash
chmod +x test-rate-limit.sh
./test-rate-limit.sh
```

## Expected Test Output

```
========================================
  Rate Limiter Comprehensive Test
========================================

Test 1: Burst Limit (5 requests/10s)
Making 6 rapid requests...
  Request 1: 200 OK
  Request 2: 200 OK
  Request 3: 200 OK
  Request 4: 200 OK
  Request 5: 200 OK
  Request 6: 429 RATE LIMITED
✓ Burst limit working correctly

Waiting 11 seconds for burst window reset...

Test 2: Main Window Limit (10 requests/minute)
Making 11 requests with 2s gaps...
  Request 1: 200 OK
  Request 2: 200 OK
  ...
  Request 10: 200 OK
  Request 11: 429 RATE LIMITED
✓ Main window limit working correctly

Test 3: Rate Limit Headers
✓ Rate limit headers present
  X-RateLimit-Limit: 10
  X-RateLimit-Remaining: 9
  X-RateLimit-Burst-Limit: 5
  X-RateLimit-Burst-Remaining: 4

Test 4: Error Message Quality
✓ Error response structured correctly
  Message: Burst limit exceeded. Maximum 5 requests per 10 seconds.
  Retry After: 8 seconds

========================================
         Test Suite Complete
========================================
```

## Monitoring Rate Limits

### Real-time Header Monitoring

```bash
# Watch headers change with each request
watch -n 1 'curl -s -i http://localhost:3000/api/v1/users/1 | grep X-RateLimit'
```

### JSON Parsing

```bash
# Extract and format rate limit info
curl -s -i http://localhost:3000/api/v1/users/1 | \
  grep X-RateLimit | \
  awk '{print $1 " " $2}' | \
  sed 's/://' | \
  jq -R 'split(" ") | {(.[0]): .[1]}'
```

### Log Failed Requests

```bash
# Monitor for 429 responses
while true; do
  code=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3000/api/v1/users/1)
  if [ "$code" = "429" ]; then
    echo "$(date): Rate limit exceeded"
  fi
  sleep 1
done
```

## Performance Testing

### Apache Bench (ab)

```bash
# Test with 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3000/api/v1/users/1

# Look for:
# - Failed requests
# - Non-2xx responses (should see some 429s)
```

### wrk (HTTP benchmarking tool)

```bash
# 10 connections, 30 second duration
wrk -t10 -c10 -d30s http://localhost:3000/api/v1/users/1

# Many requests will be rate limited
```

## Understanding Rate Limit Errors

### Burst Limit Error

```json
{
  "message": "Burst limit exceeded. Maximum 5 requests per 10 seconds.",
  "retryAfter": 8
}
```

**Meaning**: You made more than 5 requests in 10 seconds. Wait 8 seconds before retrying.

### Main Window Error

```json
{
  "message": "Rate limit exceeded. Maximum 10 requests per 60 seconds.",
  "retryAfter": 45
}
```

**Meaning**: You made more than 10 requests in the last minute. Wait 45 seconds before retrying.

## Client-Side Best Practices

### Respect Retry-After

```javascript
// JavaScript example
async function makeRequest() {
  try {
    const response = await fetch('http://localhost:3000/api/v1/users/1');
    
    if (response.status === 429) {
      const data = await response.json();
      const retryAfter = data.retryAfter || 10;
      
      console.log(`Rate limited. Retrying in ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      
      return makeRequest(); // Retry
    }
    
    return await response.json();
  } catch (error) {
    console.error('Request failed:', error);
  }
}
```

### Monitor Headers

```javascript
// Check remaining requests before making more
async function smartRequest() {
  const response = await fetch('http://localhost:3000/api/v1/users/1');
  
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const burstRemaining = response.headers.get('X-RateLimit-Burst-Remaining');
  
  console.log(`Remaining: ${remaining} main, ${burstRemaining} burst`);
  
  if (parseInt(remaining) < 2) {
    console.warn('Approaching rate limit!');
  }
  
  return await response.json();
}
```

## Troubleshooting

### Issue: Getting 429 Immediately

**Possible Causes**:
1. Previous requests within the window
2. Shared IP address (multiple users)
3. Test script still running

**Solution**: Wait 60 seconds for full reset or restart server

### Issue: Rate Limit Not Triggering

**Possible Causes**:
1. Different IP addresses per request
2. Middleware not applied to route
3. Rate limiter not initialized

**Solution**: Check middleware order and verify IP consistency

### Issue: Headers Missing

**Possible Causes**:
1. Middleware order incorrect
2. Error occurred before rate limiter

**Solution**: Ensure rate limiter middleware is applied correctly

## Summary

✅ **Burst Protection**: 5 requests per 10 seconds
✅ **Main Limit**: 10 requests per minute  
✅ **Sliding Window**: No edge case exploits
✅ **Clear Errors**: 429 with retry-after
✅ **Informative Headers**: Track remaining requests
✅ **Automatic Recovery**: Limits reset automatically

The rate limiter is production-ready and protects your API from abuse while providing clear feedback to clients! 🚀

