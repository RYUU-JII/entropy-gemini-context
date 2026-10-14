export async function mapWithConcurrency(items, worker, concurrency = 8) {
  if (!Array.isArray(items) || items.length === 0) return;

  const maxConcurrency = Math.max(1, Math.min(Number(concurrency) || 1, items.length));
  let index = 0;

  const runners = Array.from({ length: maxConcurrency }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
}

export default mapWithConcurrency;
