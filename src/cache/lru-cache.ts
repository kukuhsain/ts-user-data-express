/**
 * LRU Cache Node
 */
class CacheNode<T> {
  key: string;
  value: T;
  timestamp: number;
  prev: CacheNode<T> | null = null;
  next: CacheNode<T> | null = null;

  constructor(key: string, value: T) {
    this.key = key;
    this.value = value;
    this.timestamp = Date.now();
  }
}

/**
 * Cache Statistics Interface
 */
export type CacheStats = {
  hits: number;
  misses: number;
  size: number;
  capacity: number;
  evictions: number;
  expirations: number;
};

/**
 * LRU Cache with Time-based Expiration
 */
export class LRUCache<T> {
  private capacity: number;
  private ttl: number; // Time to live in milliseconds
  private cache: Map<string, CacheNode<T>>;
  private head: CacheNode<T> | null = null;
  private tail: CacheNode<T> | null = null;

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  // Background cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(capacity: number = 100, ttlSeconds: number = 60) {
    this.capacity = capacity;
    this.ttl = ttlSeconds * 1000; // Convert to milliseconds
    this.cache = new Map();

    // Start background cleanup task
    this.startCleanupTask();
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const node = this.cache.get(key);

    if (!node) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(node)) {
      this.stats.misses++;
      this.stats.expirations++;
      this.remove(key);
      return null;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    this.stats.hits++;
    return node.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // If key already exists, update it
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      node.timestamp = Date.now();
      this.moveToFront(node);
      return;
    }

    // Create new node
    const newNode = new CacheNode(key, value);

    // If at capacity, remove least recently used (tail)
    if (this.cache.size >= this.capacity) {
      this.removeLRU();
    }

    // Add to cache and front of list
    this.cache.set(key, newNode);
    this.addToFront(newNode);
  }

  /**
   * Remove a specific key from cache
   */
  remove(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * Get current cache statistics
   */
  getStats(): CacheStats {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      capacity: this.capacity,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.stats.expirations = 0;
  }

  /**
   * Check if a cache entry has expired
   */
  private isExpired(node: CacheNode<T>): boolean {
    return Date.now() - node.timestamp > this.ttl;
  }

  /**
   * Move node to front (most recently used)
   */
  private moveToFront(node: CacheNode<T>): void {
    if (node === this.head) {
      return;
    }

    this.removeNode(node);
    this.addToFront(node);
  }

  /**
   * Add node to front of list
   */
  private addToFront(node: CacheNode<T>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from list
   */
  private removeNode(node: CacheNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }
    else {
      this.tail = node.prev;
    }
  }

  /**
   * Remove least recently used entry (tail)
   */
  private removeLRU(): void {
    if (!this.tail) {
      return;
    }

    const key = this.tail.key;
    this.removeNode(this.tail);
    this.cache.delete(key);
    this.stats.evictions++;
  }

  /**
   * Start background cleanup task
   */
  private startCleanupTask(): void {
    // Run cleanup every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 10000);

    // Ensure cleanup stops when process exits
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const keysToRemove: string[] = [];

    // Find all expired entries
    for (const [key, node] of this.cache.entries()) {
      if (this.isExpired(node)) {
        keysToRemove.push(key);
      }
    }

    // Remove expired entries
    for (const key of keysToRemove) {
      const node = this.cache.get(key);
      if (node) {
        this.removeNode(node);
        this.cache.delete(key);
        this.stats.expirations++;
      }
    }

    if (keysToRemove.length > 0) {
      // Cache cleanup completed
    }
  }

  /**
   * Stop background cleanup task
   */
  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Destructor - clean up resources
   */
  destroy(): void {
    this.stopCleanupTask();
    this.clear();
  }
}

export default LRUCache;
