type DamageEvent = {
    timestamp: number;
    targetID: number;
    type: string; // "damage"
  };
  
  // Given all raw damage events in a fight (any source, not just the player),
  // build a function that estimates the number of distinct enemy targets
  // "in combat" around any given timestamp.
  export function buildTargetCountEstimator(damageEvents: DamageEvent[], windowMs = 3000) {
    // Pre-sort once for efficient windowed lookups
    const sorted = [...damageEvents].sort((a, b) => a.timestamp - b.timestamp);
  
    return function getTargetCountAt(timestamp: number): number {
      const windowStart = timestamp - windowMs;
      const windowEnd = timestamp + windowMs;
  
      const targets = new Set<number>();
      for (const e of sorted) {
        if (e.timestamp < windowStart) continue;
        if (e.timestamp > windowEnd) break;
        targets.add(e.targetID);
      }
  
      return targets.size;
    };
  }