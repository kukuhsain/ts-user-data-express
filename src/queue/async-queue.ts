/**
 * Asynchronous Queue for Managing Database Requests
 *
 * Features:
 * - Concurrent processing with configurable concurrency
 * - Request deduplication (multiple requests for same data share result)
 * - Queue statistics tracking
 * - Error handling and retry mechanism
 * - Non-blocking operation
 */

/**
 * Queue job interface
 */
interface QueueJob<T> {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
  retries: number;
}

/**
 * Queue statistics interface
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageProcessingTime: number;
  totalProcessed: number;
}

/**
 * Queue configuration
 */
interface QueueConfig {
  concurrency: number; // Max concurrent jobs
  maxRetries: number; // Max retry attempts
  retryDelay: number; // Delay between retries (ms)
  deduplication: boolean; // Enable request deduplication
}

/**
 * Async Queue Implementation
 */
export class AsyncQueue<T> {
  private config: QueueConfig;
  private queue: QueueJob<T>[] = [];
  private processing = 0;
  private deduplicationMap: Map<string, Promise<T>> = new Map();

  // Statistics
  private stats = {
    completed: 0,
    failed: 0,
    totalProcessingTime: 0,
  };

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      concurrency: config.concurrency || 5,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      deduplication: config.deduplication !== false,
    };
  }

  /**
   * Add a job to the queue
   */
  async enqueue(key: string, task: () => Promise<T>): Promise<T> {
    // Check for duplicate requests (deduplication)
    if (this.config.deduplication && this.deduplicationMap.has(key)) {
      return this.deduplicationMap.get(key)!;
    }

    // Create a promise that will be resolved when the job completes
    const promise = new Promise<T>((resolve, reject) => {
      const job: QueueJob<T> = {
        id: key,
        task,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0,
      };

      this.queue.push(job);
      this.processNext();
    });

    // Store promise for deduplication
    if (this.config.deduplication) {
      this.deduplicationMap.set(key, promise);

      // Clean up after completion
      promise.finally(() => {
        this.deduplicationMap.delete(key);
      });
    }

    return promise;
  }

  /**
   * Process the next job in the queue
   */
  private async processNext(): Promise<void> {
    // Check if we can process more jobs
    if (this.processing >= this.config.concurrency || this.queue.length === 0) {
      return;
    }

    // Get next job
    const job = this.queue.shift();
    if (!job) {
      return;
    }

    this.processing++;

    try {
      const startTime = Date.now();

      // Execute the task
      const result = await job.task();

      // Track processing time
      const processingTime = Date.now() - startTime;
      this.stats.totalProcessingTime += processingTime;
      this.stats.completed++;

      // Resolve the promise
      job.resolve(result);
    }
    catch (error) {
      // Handle retry logic
      if (job.retries < this.config.maxRetries) {
        job.retries++;

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

        // Re-queue the job
        this.queue.unshift(job);
      }
      else {
        // Max retries reached - fail the job
        this.stats.failed++;
        job.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
    finally {
      this.processing--;

      // Process next job
      this.processNext();
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const totalProcessed = this.stats.completed + this.stats.failed;
    const averageProcessingTime = totalProcessed > 0
      ? this.stats.totalProcessingTime / this.stats.completed
      : 0;

    return {
      pending: this.queue.length,
      processing: this.processing,
      completed: this.stats.completed,
      failed: this.stats.failed,
      averageProcessingTime: Math.round(averageProcessingTime),
      totalProcessed,
    };
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get number of jobs currently processing
   */
  getProcessingCount(): number {
    return this.processing;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.processing === 0;
  }

  /**
   * Clear all pending jobs
   */
  clear(): void {
    // Reject all pending jobs
    for (const job of this.queue) {
      job.reject(new Error("Queue cleared"));
    }

    this.queue = [];
    this.deduplicationMap.clear();
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.completed = 0;
    this.stats.failed = 0;
    this.stats.totalProcessingTime = 0;
  }

  /**
   * Wait for all jobs to complete
   */
  async drain(): Promise<void> {
    while (!this.isEmpty()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * Create a queue instance
 */
export function createQueue<T>(config?: Partial<QueueConfig>): AsyncQueue<T> {
  return new AsyncQueue<T>(config);
}

export default AsyncQueue;

