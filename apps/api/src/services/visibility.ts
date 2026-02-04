export function calculateVisibility(lastHeartbeat: Date | null): number {
  if (!lastHeartbeat) return 0;
  const hours = (Date.now() - lastHeartbeat.getTime()) / 3600000;
  if (hours <= 6) return 100;
  if (hours <= 12) return 80;
  if (hours <= 24) return 50;
  if (hours <= 48) return 20;
  if (hours <= 72) return 5;
  return 0;
}

export function calculateRecovery(consecutiveHeartbeats: number): number {
  if (consecutiveHeartbeats >= 3) return 100;
  if (consecutiveHeartbeats >= 2) return 80;
  if (consecutiveHeartbeats >= 1) return 50;
  return 0;
}
