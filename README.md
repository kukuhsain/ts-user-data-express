# Express API with Advanced Caching & Rate Limiting

A production-ready Express TypeScript API featuring advanced LRU caching, sophisticated rate limiting, asynchronous queue processing, and comprehensive monitoring capabilities.

## 📋 What is This Project?

This is a high-performance REST API built with Express and TypeScript that demonstrates production-grade patterns for:

- **Intelligent Caching**: LRU cache with TTL to minimize database load
- **Rate Protection**: Dual-layer rate limiting (per-minute + burst protection)
- **Queue Processing**: Non-blocking asynchronous queue with request deduplication
- **Performance Monitoring**: Real-time statistics and response time tracking

## ✨ Features

### Core Features
- ✅ **RESTful User API** - Get user data with intelligent caching
- ✅ **Advanced LRU Cache** - 60-second TTL, 100-entry capacity, O(1) operations
- ✅ **Sophisticated Rate Limiting** - 10 req/min + 5 req/10s burst protection
- ✅ **Async Queue Processing** - Max 5 concurrent, with automatic retry (3 attempts)
- ✅ **Request Deduplication** - Prevents redundant database calls
- ✅ **Cache Management** - Manual clear and comprehensive status endpoints

### Monitoring & Observability
- ✅ **Cache Statistics** - Hits, misses, evictions, hit rate
- ✅ **Queue Statistics** - Pending, processing, completed, failed requests
- ✅ **Response Time Tracking** - Average response time monitoring
- ✅ **Rate Limit Headers** - Real-time limit and remaining count
- ✅ **Unified Status Endpoint** - Complete system health in one call

### Technical Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express v5
- **Testing**: Vitest + Supertest
- **Code Quality**: ESLint with strict TypeScript
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Morgan HTTP request logger

## 🚀 How to Run the Project

### Prerequisites
- Node.js (v18 or higher)
- pnpm or npm

### Installation

Using **pnpm** (recommended):
```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

Using **npm**:
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Additional Commands

```bash
# Run tests
pnpm test        # or: npm test

# Run linter
pnpm lint        # or: npm run lint

# Type check
pnpm type-check  # or: npm run type-check
```

The API will start on `http://localhost:3000` by default.

## 📡 API Endpoints

### Base URL
```
http://localhost:3000
```

### 1. Get User by ID
Retrieve a user's information with intelligent caching.

```bash
GET /users/:id
```

**Example:**
```bash
curl http://localhost:3000/users/1
```

**Success Response (200):**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Burst-Limit: 5
X-RateLimit-Burst-Remaining: 3
```

**Error Responses:**
- `400 Bad Request` - Invalid user ID format
- `404 Not Found` - User does not exist
- `429 Too Many Requests` - Rate limit exceeded

---

### 2. Get Cache Statistics
View detailed cache performance metrics.

```bash
GET /users/cache/stats
```

**Example:**
```bash
curl http://localhost:3000/users/cache/stats
```

**Response (200):**
```json
{
  "hits": 150,
  "misses": 25,
  "size": 3,
  "capacity": 100,
  "evictions": 0,
  "expirations": 5
}
```

---

### 3. Get Queue Statistics
View asynchronous queue processing metrics.

```bash
GET /users/queue/stats
```

**Example:**
```bash
curl http://localhost:3000/users/queue/stats
```

**Response (200):**
```json
{
  "pending": 0,
  "processing": 1,
  "completed": 175,
  "failed": 0,
  "averageProcessingTime": 202,
  "totalProcessed": 175
}
```

---

### 4. Get Comprehensive Status
Get a unified view of cache, queue, and performance metrics.

```bash
GET /users/cache-status
```

**Example:**
```bash
curl http://localhost:3000/users/cache-status
```

**Response (200):**
```json
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
    "completed": 175,
    "failed": 0,
    "averageProcessingTime": 202
  },
  "timestamp": "2025-10-02T13:45:30.123Z"
}
```

---

### 5. Clear Cache
Manually clear all cached entries.

```bash
DELETE /users/cache
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/users/cache
```

**Response (200):**
```json
{
  "message": "Cache cleared successfully",
  "timestamp": "2025-10-02T13:45:30.123Z"
}
```

## 🧪 How to Test APIs Using curl

### Basic Testing

**1. Test user endpoint (first call - cache miss):**
```bash
curl http://localhost:3000/users/1
# Response time: ~200ms (database call)
```

**2. Test cached response (second call - cache hit):**
```bash
curl http://localhost:3000/users/1
# Response time: ~2-5ms (from cache)
```

**3. Check comprehensive status:**
```bash
curl http://localhost:3000/users/cache-status | jq
```

**4. View cache statistics:**
```bash
curl http://localhost:3000/users/cache/stats | jq
```

**5. View queue statistics:**
```bash
curl http://localhost:3000/users/queue/stats | jq
```

**6. Clear cache:**
```bash
curl -X DELETE http://localhost:3000/users/cache | jq
```

---

## 💾 How Cache Works

### Cache Architecture

The application uses a custom **LRU (Least Recently Used) Cache** implementation:

```
┌─────────────────────────────────────┐
│         Request Received            │
└───────────────┬─────────────────────┘
                │
                ▼
        ┌───────────────┐
        │  Check Cache  │
        └───────┬───────┘
                │
        ┌───────┴────────┐
        │                │
     FOUND            NOT FOUND
        │                │
        ▼                ▼
  ┌─────────┐      ┌──────────────┐
  │ Return  │      │ Queue to DB  │
  │ Cached  │      │   (~200ms)   │
  │  Data   │      └──────┬───────┘
  │ (~2ms)  │             │
  └─────────┘             ▼
                   ┌──────────────┐
                   │  Store in    │
                   │    Cache     │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │    Return    │
                   │    Result    │
                   └──────────────┘
```

### Cache Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Capacity** | 100 entries | Maximum number of cached items |
| **TTL** | 60 seconds | Time before entry expires |
| **Eviction** | LRU | Least Recently Used strategy |
| **Cleanup** | Every 10s | Background cleanup interval |
| **Operations** | O(1) | Get, Set, Delete complexity |

### How It Works

1. **Cache Hit (85% of requests)**
   - Request arrives → Check cache → Found → Return immediately
   - **Response time: 2-5ms** ⚡

2. **Cache Miss (15% of requests)**
   - Request arrives → Check cache → Not found → Query database
   - Store result in cache → Return to client
   - **Response time: ~200ms**

3. **Automatic Expiration**
   - Entries expire after 60 seconds (TTL)
   - Background cleanup runs every 10 seconds
   - Expired entries are automatically removed

4. **LRU Eviction**
   - When cache reaches 100 entries
   - Least recently used entry is removed
   - Makes room for new entries

5. **Request Deduplication**
   - Multiple simultaneous requests for same user
   - Only ONE database call is made
   - All requests share the same result

### Cache Management

**View cache statistics:**
```bash
curl http://localhost:3000/users/cache/stats
```

**Clear cache manually:**
```bash
curl -X DELETE http://localhost:3000/users/cache
```

**Monitor cache performance:**
```bash
curl http://localhost:3000/users/cache-status | jq '.cache'
```

## 🚦 How Rate Limiting Works

### Rate Limiting Architecture

The application implements a **dual-layer sliding window rate limiter**:

```
┌──────────────────────────────────────┐
│         Request Received             │
└────────────────┬─────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │  Check Burst  │
         │ (5 req/10s)   │
         └───────┬───────┘
                 │
         ┌───────┴────────┐
         │                │
      ALLOWED          EXCEEDED
         │                │
         ▼                ▼
  ┌──────────────┐  ┌─────────────┐
  │ Check Main   │  │   429 Error │
  │ (10 req/min) │  │ Retry-After │
  └──────┬───────┘  └─────────────┘
         │
  ┌──────┴────────┐
  │               │
ALLOWED       EXCEEDED
  │               │
  ▼               ▼
┌──────┐    ┌─────────────┐
│Allow │    │  429 Error  │
│Pass  │    │ Retry-After │
└──────┘    └─────────────┘
```
