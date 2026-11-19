/**
 * Supabase returns at most 1,000 rows per request and silently drops the rest. For queries
 * that grow with your history (every lift you've ever logged), page through until done.
 * `page(from, to)` must build a fresh query each call, ordered by a unique column.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < size * 100; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}
