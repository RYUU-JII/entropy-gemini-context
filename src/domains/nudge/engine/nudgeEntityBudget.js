export function resolveNudgeLiveEntityLimit(config, totalSpawned, entitiesLength) {
  const maxSprites = Math.max(1, Number(config?.maxSprites) || 1);
  const maxTotalSpawned = Math.max(0, Number(config?.maxTotalSpawned) || 0);
  const remainingSpawnBudget = Math.max(
    0,
    maxTotalSpawned - Math.max(0, Number(totalSpawned) || 0),
  );
  const totalBudgetCap = Math.max(0, Number(entitiesLength) || 0) + remainingSpawnBudget;
  return Math.max(1, Math.min(maxSprites, totalBudgetCap));
}
