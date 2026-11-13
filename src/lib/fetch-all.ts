import "server-only";

/**
 * 1000件を超える一覧も取りこぼさないよう、1000件ずつ分けて取り出す。
 * make(from, to) には、範囲（.range(from, to)）を付けた問い合わせを返す関数を渡す。
 */
export async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999);
    if (error) throw error;
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return all;
  }
}
