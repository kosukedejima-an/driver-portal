// テスト用のダミーの情報集（内容はすべて架空）。「ダミーデータを入れる／消す」で一緒に出し入れする。
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type DummyDoc = {
  genre: string;
  title: string;
  body: string;
  /** 何日前に登録したか */
  createdDaysAgo: number;
  /** 何日前に「更新」として知らせたか（無ければ登録時のまま） */
  updatedDaysAgo?: number;
  /** 開いた人の割合の目安 */
  viewRate: number;
  /** 確認ボタンを付ける（開いた人の半分くらいが確認済み） */
  requiresConfirm?: boolean;
};

const DOCS: DummyDoc[] = [
  {
    genre: "安全・事故防止",
    title: "構内でのバックの基本",
    body: "1. 後退する前に、必ず一度降りて後ろを目で確認する\n2. 誘導員がいるときは、誘導員の合図に従う\n3. バックモニターは補助として使い、モニターだけに頼らない\n4. 少しでも不安があれば、止まってもう一度確認する\n（ダミーの資料です）",
    createdDaysAgo: 40,
    viewRate: 0.8,
    requiresConfirm: true,
  },
  {
    genre: "車両・点検",
    title: "冬用タイヤの点検手順",
    body: "冬用タイヤに交換したら、次の点を確認してください。\n・溝の深さ（プラットホームが出ていないか）\n・ひび割れや傷がないか\n・空気圧が決められた値か\n・ナットの締め付け（交換後100kmで増し締め）\n今年から、増し締めの確認表を追加しました。（ダミーの資料です）",
    createdDaysAgo: 30,
    updatedDaysAgo: 2,
    viewRate: 0.7,
  },
  {
    genre: "荷扱い・積み込み",
    title: "荷物の積み方と固定",
    body: "・重い荷物を下に、配送順の最後の配送先の荷物を奥に積む\n・ラッシングベルトは荷を降ろすたびに締め直す\n・後部扉のロックは両側とも手で引いて確認する\n（ダミーの資料です）",
    createdDaysAgo: 20,
    viewRate: 0.6,
  },
  {
    genre: "構内・物流センターのルール",
    title: "架空第一物流センター 構内の通行ルール",
    body: "・構内の制限速度は時速10キロ\n・フォークリフトの通路を横切るときは一時停止\n・待機は指定の待機場所で、エンジンを止めて待つ\n（ダミーの資料です。実在の施設とは関係ありません）",
    createdDaysAgo: 10,
    viewRate: 0.5,
    requiresConfirm: true,
  },
  {
    genre: "就業規則・総務",
    title: "休暇の申請方法",
    body: "休暇を取りたい日の2週間前までに、営業所の担当者へ申し出てください。急な体調不良のときは、出発前点呼の前に電話で連絡してください。（ダミーの資料です）",
    createdDaysAgo: 60,
    viewRate: 0.4,
  },
  {
    genre: "研修・教育",
    title: "新人ドライバー研修の流れ",
    body: "1日目：会社の決まりと安全の基本\n2〜3日目：先輩ドライバーへの同乗\n4日目以降：先輩の同乗のもとで運転\n（ダミーの資料です）",
    createdDaysAgo: 1,
    viewRate: 0.15,
  },
];

function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function clearDummyLibrary(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.from("library_items").delete().eq("is_dummy", true).select("id");
  return error ? 0 : data.length; // supabase/setup.sql 実行前は何もしない
}

/** ダミーの資料と「開いた記録」を入れる。情報集の仕組みがまだ無ければ何もしない */
export async function seedDummyLibrary(admin: SupabaseClient, driverIds: string[]): Promise<number> {
  const { data: genres, error } = await admin.from("library_genres").select("id, name");
  if (error || !genres) return 0;
  const genreId = new Map(genres.map((g) => [g.name as string, g.id as string]));
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const random = seededRandom(777);
  let count = 0;
  for (const d of DOCS) {
    const gid = genreId.get(d.genre) ?? genres[0]?.id;
    if (!gid) break;
    const created = now - d.createdDaysAgo * day;
    const contentUpdated = now - (d.updatedDaysAgo ?? d.createdDaysAgo) * day;
    const row: Record<string, string | boolean> = {
      genre_id: gid,
      title: d.title,
      body: d.body,
      created_at: new Date(created).toISOString(),
      content_updated_at: new Date(contentUpdated).toISOString(),
      is_dummy: true,
    };
    let { data: item, error: e } = await admin
      .from("library_items")
      .insert(d.requiresConfirm ? { ...row, requires_confirm: true } : row)
      .select("id")
      .single();
    // 確認ボタンの列（supabase/setup.sql）がまだ無ければ、ボタンなしで入れる
    if (e && d.requiresConfirm) ({ data: item, error: e } = await admin.from("library_items").insert(row).select("id").single());
    if (e || !item) return count;
    count++;
    // 開いた時刻は登録から今までのどこか。更新がある資料は、更新前に開いた人も混ざる
    const itemId = item.id as string;
    const views = driverIds
      .filter(() => random() < d.viewRate)
      .map((user_id) => {
        const viewed_at = new Date(created + random() * (now - created)).toISOString();
        return d.requiresConfirm && random() < 0.6 ? { item_id: itemId, user_id, viewed_at, confirmed_at: viewed_at } : { item_id: itemId, user_id, viewed_at };
      });
    if (views.length) {
      const { error: ve } = await admin.from("library_views").insert(views);
      // 確認の列がまだ無ければ、開いた記録だけ入れる
      if (ve) await admin.from("library_views").insert(views.map(({ item_id, user_id, viewed_at }) => ({ item_id, user_id, viewed_at })));
    }
  }
  return count;
}
