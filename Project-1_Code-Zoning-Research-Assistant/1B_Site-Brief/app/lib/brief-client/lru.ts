/** Small LRU with optional TTL. Map insertion order is the recency order. */
export class Lru<V> {
  private map = new Map<string, { v: V; at: number }>();
  hits = 0;
  misses = 0;
  constructor(private max: number, private ttlMs = Infinity) {}

  get(key: string, now = Date.now()): V | undefined {
    const e = this.map.get(key);
    if (!e || now - e.at > this.ttlMs) {
      if (e) this.map.delete(key);
      this.misses++;
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, e);
    this.hits++;
    return e.v;
  }
  /** Lookup that does not touch hit/miss counters or recency. */
  peek(key: string): V | undefined {
    return this.map.get(key)?.v;
  }
  set(key: string, v: V, now = Date.now()): void {
    this.map.delete(key);
    this.map.set(key, { v, at: now });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
  get size(): number {
    return this.map.size;
  }
}
