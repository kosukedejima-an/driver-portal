-- =====================================================================
-- ドライバーポータル：データベースの設定（まとめて1回で入れる）
--
-- 使い方：Supabase の「SQL Editor」を開き、このファイルの中身を全部貼り付けて「Run」を押す。
-- 新しく作った Supabase のプロジェクトで、1回だけ実行してください。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 基本の表（営業所・社員・お知らせ・確認記録・写真の置き場所）
-- ---------------------------------------------------------------------
-- 営業所
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 社員（ログインアカウントと1対1）
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  employee_no text unique,
  full_name text not null,
  office_id uuid references public.offices (id),
  role text not null default 'driver' check (role in ('driver', 'admin')),
  created_at timestamptz not null default now()
);

-- お知らせ
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('事故速報', '安全・運行', '社内報', '総務')),
  title text not null,
  body text,
  accident_situation text,
  accident_cause text,
  accident_prevention text,
  photo_path text,
  photo_caption text,
  author_label text not null,
  author_id uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- 事故速報は3項目、それ以外は本文が必須
  constraint notices_content_check check (
    (category = '事故速報'
      and accident_situation is not null
      and accident_cause is not null
      and accident_prevention is not null)
    or (category <> '事故速報' and body is not null)
  )
);

-- 確認記録（だれが、どのお知らせを、いつ確認したか）
create table public.notice_reads (
  notice_id uuid not null references public.notices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);
create index notice_reads_user_id_idx on public.notice_reads (user_id);

-- 管理者かどうかを判定する（権限設定の中で使う）
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- お知らせごとの確認人数（ドライバーのみ数える。管理者画面で使う）
create view public.notice_read_summary
with (security_invoker = true)
as
select
  n.id as notice_id,
  count(r.user_id) filter (where p.role = 'driver') as read_count
from public.notices n
left join public.notice_reads r on r.notice_id = n.id
left join public.profiles p on p.id = r.user_id
group by n.id;

-- ---------------------------------------------------------------------
-- 権限設定（RLS）：ログインした社員だけが、許された範囲のデータを扱える
-- ---------------------------------------------------------------------
alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;

-- 営業所：ログインした人は閲覧可、変更は管理者のみ
create policy "offices_select" on public.offices
  for select to authenticated using (true);
create policy "offices_admin_write" on public.offices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 社員：自分の情報は閲覧可、全員分の閲覧と変更は管理者のみ
create policy "profiles_select" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_write" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- お知らせ：公開日時を過ぎたものは閲覧可、投稿・変更は管理者のみ
create policy "notices_select" on public.notices
  for select to authenticated using (published_at <= now() or public.is_admin());
create policy "notices_admin_write" on public.notices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 確認記録：自分の記録の閲覧と追加のみ。全員分の閲覧は管理者のみ
create policy "notice_reads_select" on public.notice_reads
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "notice_reads_insert_own" on public.notice_reads
  for insert to authenticated with check (user_id = auth.uid());

-- アプリから使えるようにする（実際の範囲は上の権限設定で制限される）
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.offices, public.profiles, public.notices to authenticated;
grant select, insert on public.notice_reads to authenticated;
grant select on public.notice_read_summary to authenticated;
grant execute on function public.is_admin() to authenticated;
revoke all on public.offices, public.profiles, public.notices, public.notice_reads, public.notice_read_summary from anon;

-- ---------------------------------------------------------------------
-- 写真の置き場所（非公開。ログインした人だけ閲覧可、追加は管理者のみ）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('notice-photos', 'notice-photos', false)
on conflict (id) do nothing;

create policy "notice_photos_select" on storage.objects
  for select to authenticated using (bucket_id = 'notice-photos');
create policy "notice_photos_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'notice-photos' and public.is_admin());
create policy "notice_photos_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'notice-photos' and public.is_admin());
create policy "notice_photos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'notice-photos' and public.is_admin());

-- ---------------------------------------------------------------------
-- 2. ダミーデータの印
-- ---------------------------------------------------------------------
alter table public.notices add column if not exists is_dummy boolean not null default false;
alter table public.profiles add column if not exists is_dummy boolean not null default false;

-- ---------------------------------------------------------------------
-- 3. お知らせの非表示・削除と操作の記録
-- ---------------------------------------------------------------------
-- 非表示・編集の情報
alter table public.notices
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------
-- 権限設定の見直し
-- ---------------------------------------------------------------------
-- ドライバー：非表示のお知らせは見えない（管理者はすべて見える）
drop policy if exists "notices_select" on public.notices;
create policy "notices_select" on public.notices
  for select to authenticated
  using ((hidden_at is null and published_at <= now()) or public.is_admin());

-- 投稿・編集は管理者のみ。完全削除は「非表示にしたもの」だけ
drop policy if exists "notices_admin_write" on public.notices;
drop policy if exists "notices_admin_insert" on public.notices;
create policy "notices_admin_insert" on public.notices
  for insert to authenticated with check (public.is_admin());
drop policy if exists "notices_admin_update" on public.notices;
create policy "notices_admin_update" on public.notices
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "notices_admin_delete" on public.notices;
create policy "notices_admin_delete" on public.notices
  for delete to authenticated using (public.is_admin() and hidden_at is not null);

-- 確認記録：見えている（非表示でない）お知らせにだけ付けられる
drop policy if exists "notice_reads_insert_own" on public.notice_reads;
create policy "notice_reads_insert_own" on public.notice_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.notices n where n.id = notice_id)
  );

-- ---------------------------------------------------------------------
-- 操作記録（だれが、いつ、何をしたか）
-- データベースが自動で書き込む。アプリからは書き換え・削除できない
-- ---------------------------------------------------------------------
create table if not exists public.notice_audit_logs (
  id bigint generated always as identity primary key,
  notice_id uuid not null,          -- 削除後も残すため、お知らせとはつながない
  notice_title text not null,       -- 操作した時点のタイトル
  action text not null check (action in ('create', 'edit', 'hide', 'unhide', 'delete')),
  changed_fields text[],            -- 編集で変わった項目
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,                  -- 操作した時点の氏名
  created_at timestamptz not null default now()
);
create index if not exists notice_audit_logs_notice_idx
  on public.notice_audit_logs (notice_id, created_at desc);
create index if not exists notice_audit_logs_created_idx
  on public.notice_audit_logs (created_at desc);

alter table public.notice_audit_logs enable row level security;
drop policy if exists "notice_audit_logs_admin_select" on public.notice_audit_logs;
create policy "notice_audit_logs_admin_select" on public.notice_audit_logs
  for select to authenticated using (public.is_admin());
grant select on public.notice_audit_logs to authenticated;
revoke all on public.notice_audit_logs from anon;

-- 編集・非表示の日時と操作した人を、自動で書き込む
create or replace function public.notices_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.category, new.title, new.body, new.accident_situation, new.accident_cause,
      new.accident_prevention, new.photo_path, new.photo_caption, new.author_label)
     is distinct from
     (old.category, old.title, old.body, old.accident_situation, old.accident_cause,
      old.accident_prevention, old.photo_path, old.photo_caption, old.author_label) then
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  if new.hidden_at is distinct from old.hidden_at then
    new.hidden_by := case when new.hidden_at is null then null else auth.uid() end;
  end if;
  return new;
end;
$$;

drop trigger if exists notices_before_update on public.notices;
create trigger notices_before_update
  before update on public.notices
  for each row execute function public.notices_before_update();

-- 投稿・編集・非表示・再表示・削除を操作記録に残す
create or replace function public.log_notice_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_label text;
  act text;
  fields text[] := '{}';
  rec public.notices;
begin
  -- ログインした人の操作だけを記録する（ダミーデータの出し入れなど、システムの処理は記録しない）
  if actor is null then
    return null;
  end if;
  select full_name into actor_label from public.profiles where id = actor;

  if tg_op = 'INSERT' then
    act := 'create';
    rec := new;
  elsif tg_op = 'DELETE' then
    act := 'delete';
    rec := old;
  else
    rec := new;
    if old.hidden_at is null and new.hidden_at is not null then
      act := 'hide';
    elsif old.hidden_at is not null and new.hidden_at is null then
      act := 'unhide';
    else
      act := 'edit';
      if new.category is distinct from old.category then fields := array_append(fields, 'category'); end if;
      if new.title is distinct from old.title then fields := array_append(fields, 'title'); end if;
      if new.author_label is distinct from old.author_label then fields := array_append(fields, 'author_label'); end if;
      if new.body is distinct from old.body then fields := array_append(fields, 'body'); end if;
      if new.accident_situation is distinct from old.accident_situation then fields := array_append(fields, 'accident_situation'); end if;
      if new.accident_cause is distinct from old.accident_cause then fields := array_append(fields, 'accident_cause'); end if;
      if new.accident_prevention is distinct from old.accident_prevention then fields := array_append(fields, 'accident_prevention'); end if;
      if new.photo_path is distinct from old.photo_path then fields := array_append(fields, 'photo_path'); end if;
      if new.photo_caption is distinct from old.photo_caption then fields := array_append(fields, 'photo_caption'); end if;
      if cardinality(fields) = 0 then
        return null; -- 何も変わっていない
      end if;
    end if;
  end if;

  insert into public.notice_audit_logs (notice_id, notice_title, action, changed_fields, actor_id, actor_name)
  values (rec.id, rec.title, act, nullif(fields, '{}'), actor, actor_label);
  return null;
end;
$$;

drop trigger if exists notices_audit on public.notices;
create trigger notices_audit
  after insert or update or delete on public.notices
  for each row execute function public.log_notice_change();

-- ---------------------------------------------------------------------
-- 4. 社員の権限の切り替え
-- ---------------------------------------------------------------------
-- 権限の変更記録（だれが、いつ、だれの権限を、何から何に変えたか）
create table if not exists public.role_change_logs (
  id bigint generated always as identity primary key,
  target_id uuid references public.profiles (id) on delete set null,
  target_name text not null,           -- 変更した時点の氏名
  target_employee_no text,
  old_role text,                       -- 新しく登録したときは空
  new_role text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,                     -- 空のときは SQL Editor など、アプリ以外からの変更
  created_at timestamptz not null default now()
);
create index if not exists role_change_logs_created_idx on public.role_change_logs (created_at desc);

alter table public.role_change_logs enable row level security;
drop policy if exists "role_change_logs_admin_select" on public.role_change_logs;
create policy "role_change_logs_admin_select" on public.role_change_logs
  for select to authenticated using (public.is_admin());
grant select on public.role_change_logs to authenticated;
revoke all on public.role_change_logs from anon;

-- 権限変更の安全装置：自分の管理者権限は外せない。管理者が1人もいなくなる変更もできない
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    if old.id = auth.uid() then
      raise exception '自分自身の管理者権限は外せません' using errcode = 'P0001', hint = 'self_demote';
    end if;
    if (select count(*) from public.profiles where role = 'admin' and id <> old.id) = 0 then
      raise exception '管理者が1人もいなくなるため、変更できません' using errcode = 'P0001', hint = 'last_admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update of role on public.profiles
  for each row execute function public.profiles_guard_role();

-- 権限の変更（と、管理者としての新規登録）を自動で記録する
create or replace function public.log_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_label text;
begin
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then
    return null;
  end if;
  -- 新規登録はドライバーなら記録しない（ダミー社員の登録など）
  if tg_op = 'INSERT' and new.role <> 'admin' then
    return null;
  end if;
  if actor is not null then
    select full_name into actor_label from public.profiles where id = actor;
  end if;
  insert into public.role_change_logs
    (target_id, target_name, target_employee_no, old_role, new_role, actor_id, actor_name)
  values
    (new.id, new.full_name, new.employee_no,
     case when tg_op = 'UPDATE' then old.role end, new.role, actor, actor_label);
  return null;
end;
$$;

drop trigger if exists profiles_log_role on public.profiles;
create trigger profiles_log_role
  after insert or update of role on public.profiles
  for each row execute function public.log_role_change();

-- ---------------------------------------------------------------------
-- 5. ログイン方式（ドライバーは社員番号だけ・管理者はパスワード）と利用停止
-- ---------------------------------------------------------------------
-- 利用停止の印（false = 利用停止中）
alter table public.profiles add column if not exists is_active boolean not null default true;

-- ログインした人が「利用中の社員」かどうか
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;
grant execute on function public.is_active_member() to authenticated;

-- 管理者かどうか：管理者で、利用中で、しかも「パスワードで入った」ときだけ true
-- （社員番号だけで入った場合は、管理者の社員でもドライバーと同じ扱いになる）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and is_active
    )
    and coalesce((auth.jwt() -> 'amr') @> '[{"method": "password"}]'::jsonb, false);
$$;

-- お知らせ：利用中の社員だけが見られる
drop policy if exists "notices_select" on public.notices;
create policy "notices_select" on public.notices
  for select to authenticated
  using ((public.is_active_member() and hidden_at is null and published_at <= now()) or public.is_admin());

-- 確認記録：利用中の社員だけが付けられる
drop policy if exists "notice_reads_insert_own" on public.notice_reads;
create policy "notice_reads_insert_own" on public.notice_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_member()
    and exists (select 1 from public.notices n where n.id = notice_id)
  );

-- 営業所：利用中の社員だけが見られる
drop policy if exists "offices_select" on public.offices;
create policy "offices_select" on public.offices
  for select to authenticated using (public.is_active_member() or public.is_admin());

-- 既読確認の人数は、利用中のドライバーだけで数える
create or replace view public.notice_read_summary
with (security_invoker = true)
as
select
  n.id as notice_id,
  count(r.user_id) filter (where p.role = 'driver' and p.is_active) as read_count
from public.notices n
left join public.notice_reads r on r.notice_id = n.id
left join public.profiles p on p.id = r.user_id
group by n.id;

-- ---------------------------------------------------------------------
-- 利用停止・再開も「権限の変更記録」に残す
-- ---------------------------------------------------------------------
alter table public.role_change_logs
  add column if not exists change_type text not null default 'role';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'role_change_logs_change_type_check') then
    alter table public.role_change_logs
      add constraint role_change_logs_change_type_check check (change_type in ('role', 'status'));
  end if;
end $$;

-- 安全装置：自分自身は利用停止できない。利用中の管理者が0人になる変更もできない
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active) then
    if old.id = auth.uid() then
      if new.role <> 'admin' then
        raise exception '自分自身の管理者権限は外せません' using errcode = 'P0001', hint = 'self_demote';
      end if;
      raise exception '自分自身は利用停止にできません' using errcode = 'P0001', hint = 'self_suspend';
    end if;
    if (select count(*) from public.profiles where role = 'admin' and is_active and id <> old.id) = 0 then
      raise exception '利用中の管理者が1人もいなくなるため、変更できません' using errcode = 'P0001', hint = 'last_admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update of role, is_active on public.profiles
  for each row execute function public.profiles_guard_role();

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_label text;
begin
  if new.is_active is not distinct from old.is_active then
    return null;
  end if;
  if actor is not null then
    select full_name into actor_label from public.profiles where id = actor;
  end if;
  insert into public.role_change_logs
    (target_id, target_name, target_employee_no, old_role, new_role, actor_id, actor_name, change_type)
  values
    (new.id, new.full_name, new.employee_no,
     case when old.is_active then 'active' else 'suspended' end,
     case when new.is_active then 'active' else 'suspended' end,
     actor, actor_label, 'status');
  return null;
end;
$$;

drop trigger if exists profiles_log_status on public.profiles;
create trigger profiles_log_status
  after update of is_active on public.profiles
  for each row execute function public.log_status_change();

-- ---------------------------------------------------------------------
-- ログインの記録（アプリのサーバー側からだけ書き込む。画面からは見えない）
-- ---------------------------------------------------------------------
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  ip text,
  login_id text,             -- 入力された社員番号（またはメールアドレス）
  method text not null check (method in ('number', 'password')),
  success boolean not null,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_ip_idx on public.login_attempts (ip, created_at desc);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. プッシュ通知
-- ---------------------------------------------------------------------
-- 通知を受け取るスマホの登録（1人が複数台登録することもある）
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,   -- 通知の届け先（スマホごとに違う）
  p256dh text not null,            -- 通知の中身を暗号化するための情報
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- 本人は自分の登録だけを見る・追加する・消すことができる（送信はサーバー側だけ）
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_own_select" on public.push_subscriptions;
create policy "push_subscriptions_own_select" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "push_subscriptions_own_insert" on public.push_subscriptions;
create policy "push_subscriptions_own_insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid() and public.is_active_member());
drop policy if exists "push_subscriptions_own_delete" on public.push_subscriptions;
create policy "push_subscriptions_own_delete" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- お知らせを通知した日時（同じお知らせを二重に通知しないため）
alter table public.notices add column if not exists push_sent_at timestamptz;

-- 社員ごとの未読件数（ホーム画面のアイコンの数字に使う。サーバー側だけが使える）
create or replace function public.unread_counts(target_ids uuid[])
returns table (user_id uuid, unread bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, count(n.id) filter (where r.notice_id is null)
  from unnest(target_ids) as u(id)
  join public.notices n on n.hidden_at is null and n.published_at <= now()
  left join public.notice_reads r on r.notice_id = n.id and r.user_id = u.id
  group by u.id;
$$;
revoke execute on function public.unread_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.unread_counts(uuid[]) to service_role;

-- ---------------------------------------------------------------------
-- 7. 最初の営業所
-- ---------------------------------------------------------------------
-- 最初の営業所（あとから管理者画面「社員管理」→「営業所の管理」で名前を変えたり、増やしたりできます）
insert into public.offices (name, sort_order)
select '本社営業所', 1
where not exists (select 1 from public.offices);

-- ---------------------------------------------------------------------
-- 8. 所属会社
-- ---------------------------------------------------------------------
-- 所属会社（グループ会社の社員も使うときのため。選択肢はアプリの src/config/site.ts で決める）
alter table public.profiles add column if not exists company text;

-- ---------------------------------------------------------------------
-- 9. 社員の編集・退職・完全削除と変更記録
-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- 社員の変更記録（だれが、いつ、どの社員を、どう変えたか）
-- 社員を削除しても記録は残す（社員とはつながない）
-- ---------------------------------------------------------------------
create table if not exists public.employee_audit_logs (
  id bigint generated always as identity primary key,
  target_id uuid,                       -- 社員の固定ID
  target_name text not null,            -- 操作した時点の氏名
  target_employee_no text,              -- 操作した時点の社員番号
  action text not null check (action in ('create', 'edit', 'role', 'suspend', 'resume', 'delete')),
  details text[],                       -- 変えた内容（例：「営業所：本社営業所 → 東営業所」）
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,                      -- 空のときは SQL Editor など、アプリ以外からの操作
  created_at timestamptz not null default now()
);
create index if not exists employee_audit_logs_created_idx on public.employee_audit_logs (created_at desc);
create index if not exists employee_audit_logs_target_idx on public.employee_audit_logs (target_id, created_at desc);

alter table public.employee_audit_logs enable row level security;
drop policy if exists "employee_audit_logs_admin_select" on public.employee_audit_logs;
create policy "employee_audit_logs_admin_select" on public.employee_audit_logs
  for select to authenticated using (public.is_admin());
grant select on public.employee_audit_logs to authenticated;
revoke all on public.employee_audit_logs from anon;

-- これまでの「権限・利用状況の変更記録」を、新しい記録に1回だけ写す
do $$
begin
  if not exists (select 1 from public.employee_audit_logs) and exists (select 1 from public.role_change_logs) then
    insert into public.employee_audit_logs
      (target_id, target_name, target_employee_no, action, details, actor_id, actor_name, created_at)
    select
      target_id, target_name, target_employee_no,
      case
        when change_type = 'status' and new_role = 'suspended' then 'suspend'
        when change_type = 'status' then 'resume'
        when old_role is null then 'create'
        else 'role'
      end,
      case
        when change_type = 'status' then null
        when old_role is null then array['管理者として登録']
        else array['役割：' || case old_role when 'admin' then '管理者' else 'ドライバー' end
                   || ' → ' || case new_role when 'admin' then '管理者' else 'ドライバー' end]
      end,
      actor_id, actor_name, created_at
    from public.role_change_logs
    order by id;
  end if;
end $$;

-- 古い記録のしくみは止める（新しい記録にまとめる）
drop trigger if exists profiles_log_role on public.profiles;
drop trigger if exists profiles_log_status on public.profiles;

-- 社員の追加・変更・削除を自動で記録する
create or replace function public.log_employee_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_label text;
  rec public.profiles;
  act text;
  notes text[] := '{}';
begin
  rec := case when tg_op = 'DELETE' then old else new end;
  -- ダミーデータの出し入れ（システムの処理）は記録しない
  if actor is null and rec.is_dummy then
    return null;
  end if;
  if actor is not null then
    select full_name into actor_label from public.profiles where id = actor;
  end if;

  if tg_op = 'INSERT' then
    act := 'create';
    notes := array[
      '営業所：' || coalesce((select name from public.offices where id = new.office_id), 'なし'),
      '役割：' || case new.role when 'admin' then '管理者' else 'ドライバー' end
    ];
  elsif tg_op = 'DELETE' then
    act := 'delete';
  else
    if new.full_name is distinct from old.full_name then
      notes := array_append(notes, '氏名：' || old.full_name || ' → ' || new.full_name);
    end if;
    if new.employee_no is distinct from old.employee_no then
      notes := array_append(notes, '社員番号：' || coalesce(old.employee_no, 'なし') || ' → ' || coalesce(new.employee_no, 'なし'));
    end if;
    if new.office_id is distinct from old.office_id then
      notes := array_append(notes, '営業所：'
        || coalesce((select name from public.offices where id = old.office_id), 'なし') || ' → '
        || coalesce((select name from public.offices where id = new.office_id), 'なし'));
    end if;
    if new.company is distinct from old.company then
      notes := array_append(notes, '会社：' || old.company || ' → ' || new.company);
    end if;
    if new.role is distinct from old.role then
      notes := array_append(notes, '役割：'
        || case old.role when 'admin' then '管理者' else 'ドライバー' end || ' → '
        || case new.role when 'admin' then '管理者' else 'ドライバー' end);
    end if;

    if new.is_active is distinct from old.is_active then
      act := case when new.is_active then 'resume' else 'suspend' end;
    elsif new.role is distinct from old.role and cardinality(notes) = 1 then
      act := 'role';
    else
      act := 'edit';
    end if;
    if act = 'edit' and cardinality(notes) = 0 then
      return null; -- 何も変わっていない
    end if;
  end if;

  insert into public.employee_audit_logs
    (target_id, target_name, target_employee_no, action, details, actor_id, actor_name)
  values
    (rec.id, rec.full_name, rec.employee_no, act, nullif(notes, '{}'), actor, actor_label);
  return null;
end;
$$;

drop trigger if exists profiles_log_employee on public.profiles;
create trigger profiles_log_employee
  after insert or update or delete on public.profiles
  for each row execute function public.log_employee_change();

-- ---------------------------------------------------------------------
-- 安全装置：完全に削除できるのは、退職（利用停止）にした社員だけ。自分自身も削除できない
-- （ダミー社員は「ダミーデータを消す」で消せるようにする）
-- ---------------------------------------------------------------------
create or replace function public.profiles_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.id = auth.uid() then
    raise exception '自分自身は削除できません' using errcode = 'P0001', hint = 'self_delete';
  end if;
  if old.is_active and not old.is_dummy then
    raise exception '利用中の社員は削除できません。先に退職（利用停止）にしてください'
      using errcode = 'P0001', hint = 'active_delete';
  end if;
  return old;
end;
$$;

drop trigger if exists profiles_guard_delete on public.profiles;
create trigger profiles_guard_delete
  before delete on public.profiles
  for each row execute function public.profiles_guard_delete();

-- 社員番号の重複を防ぐ（大文字・小文字の違いも同じ番号とみなす）
do $$
begin
  create unique index if not exists profiles_employee_no_lower_key on public.profiles (lower(employee_no));
exception when unique_violation then
  raise notice '大文字・小文字だけが違う社員番号がすでにあるため、重複防止の仕組みを付けられませんでした。社員管理で番号を直してから、もう一度実行してください。';
end $$;

-- ---------------------------------------------------------------------
-- 10. アンケート
-- ---------------------------------------------------------------------
-- アンケート本体
create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  anonymous boolean not null default false,   -- 無記名（だれが何と答えたかを管理者にも見せない）
  deadline timestamptz,                        -- 締め切り（空なら締め切りなし）
  published_at timestamptz not null default now(),
  hidden_at timestamptz,
  push_sent_at timestamptz,
  is_dummy boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 質問（1つ選ぶ／いくつでも選ぶ／自由に書く）
create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('single', 'multi', 'text')),
  text text not null,
  options text[] not null default '{}',
  required boolean not null default true
);
create index if not exists survey_questions_survey_idx on public.survey_questions (survey_id, position);

-- 回答（1人1回。締め切りまでは直せる）
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (survey_id, user_id)
);
create index if not exists survey_responses_user_idx on public.survey_responses (user_id);

create table if not exists public.survey_answers (
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  question_id uuid not null references public.survey_questions (id) on delete cascade,
  choice_indexes int[],
  text_value text,
  primary key (response_id, question_id)
);

-- ---------------------------------------------------------------------
-- 権限設定
-- ---------------------------------------------------------------------
alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;

-- アンケート：利用中の社員は公開中のものを見られる。作成・変更は管理者。完全削除は非表示にしたものだけ
drop policy if exists "surveys_select" on public.surveys;
create policy "surveys_select" on public.surveys for select to authenticated
  using ((public.is_active_member() and hidden_at is null and published_at <= now()) or public.is_admin());
drop policy if exists "surveys_admin_insert" on public.surveys;
create policy "surveys_admin_insert" on public.surveys for insert to authenticated with check (public.is_admin());
drop policy if exists "surveys_admin_update" on public.surveys;
create policy "surveys_admin_update" on public.surveys for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "surveys_admin_delete" on public.surveys;
create policy "surveys_admin_delete" on public.surveys for delete to authenticated
  using (public.is_admin() and hidden_at is not null);

-- 質問：見られるアンケートの質問だけ見られる。作成は管理者
drop policy if exists "survey_questions_select" on public.survey_questions;
create policy "survey_questions_select" on public.survey_questions for select to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_id));
drop policy if exists "survey_questions_admin_write" on public.survey_questions;
create policy "survey_questions_admin_write" on public.survey_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 回答した人：本人は自分の分、管理者は「だれが回答したか」だけ見られる（無記名でも、未回答者への声かけのため）
drop policy if exists "survey_responses_select" on public.survey_responses;
create policy "survey_responses_select" on public.survey_responses for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 回答の中身：本人の分だけ直接見られる。管理者は下の集計用の仕組みを通して見る（無記名を守るため）
drop policy if exists "survey_answers_select_own" on public.survey_answers;
create policy "survey_answers_select_own" on public.survey_answers for select to authenticated
  using (exists (select 1 from public.survey_responses r where r.id = response_id and r.user_id = auth.uid()));

grant select, insert, update, delete on public.surveys, public.survey_questions to authenticated;
grant select on public.survey_responses, public.survey_answers to authenticated;
revoke all on public.surveys, public.survey_questions, public.survey_responses, public.survey_answers from anon;

-- ---------------------------------------------------------------------
-- 回答する（中身を確かめてから、まとめて保存する。書き込みはこの仕組みからだけ）
-- p_answers の形：{ "質問のID": { "choices": [0, 2] } または { "text": "..." } }
-- ---------------------------------------------------------------------
create or replace function public.submit_survey_response(p_survey uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.surveys;
  q public.survey_questions;
  a jsonb;
  resp uuid;
  idxs int[];
  txt text;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception '回答できません' using errcode = 'P0001', hint = 'not_member';
  end if;
  select * into s from public.surveys where id = p_survey and hidden_at is null and published_at <= now();
  if not found then
    raise exception 'アンケートが見つかりません' using errcode = 'P0001', hint = 'not_found';
  end if;
  if s.deadline is not null and s.deadline <= now() then
    raise exception '締め切りを過ぎています' using errcode = 'P0001', hint = 'closed';
  end if;

  insert into public.survey_responses (survey_id, user_id) values (p_survey, auth.uid())
  on conflict (survey_id, user_id) do update set updated_at = now()
  returning id into resp;
  delete from public.survey_answers where response_id = resp;

  for q in select * from public.survey_questions where survey_id = p_survey order by position loop
    a := coalesce(p_answers -> q.id::text, '{}'::jsonb);
    if q.kind = 'text' then
      txt := nullif(btrim(coalesce(a ->> 'text', '')), '');
      if txt is null then
        if q.required then
          raise exception '答えていない質問があります' using errcode = 'P0001', hint = 'required';
        end if;
        continue;
      end if;
      insert into public.survey_answers (response_id, question_id, text_value) values (resp, q.id, left(txt, 2000));
    else
      select coalesce(array_agg(distinct v::int order by v::int), '{}') into idxs
      from jsonb_array_elements_text(coalesce(a -> 'choices', '[]'::jsonb)) as v;
      if exists (select 1 from unnest(idxs) i where i < 0 or i >= cardinality(q.options))
         or (q.kind = 'single' and cardinality(idxs) > 1) then
        raise exception '選び方が正しくありません' using errcode = 'P0001', hint = 'bad_choice';
      end if;
      if cardinality(idxs) = 0 then
        if q.required then
          raise exception '答えていない質問があります' using errcode = 'P0001', hint = 'required';
        end if;
        continue;
      end if;
      insert into public.survey_answers (response_id, question_id, choice_indexes) values (resp, q.id, idxs);
    end if;
  end loop;
end;
$$;
revoke execute on function public.submit_survey_response(uuid, jsonb) from public, anon;
grant execute on function public.submit_survey_response(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 集計（管理者だけ）：選択肢ごとの人数
-- ---------------------------------------------------------------------
create or replace function public.survey_choice_counts(p_survey uuid)
returns table (question_id uuid, option_index int, votes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '管理者だけが見られます' using errcode = 'P0001', hint = 'not_admin';
  end if;
  return query
    select a.question_id, i::int, count(*)
    from public.survey_answers a
    join public.survey_responses r on r.id = a.response_id
    cross join lateral unnest(a.choice_indexes) as i
    where r.survey_id = p_survey
    group by a.question_id, i;
end;
$$;

-- 自由記述の回答（管理者だけ）。無記名のアンケートは名前を付けず、順番も混ぜて出す
create or replace function public.survey_text_answers(p_survey uuid)
returns table (question_id uuid, text_value text, respondent text, office text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  anon boolean;
begin
  if not public.is_admin() then
    raise exception '管理者だけが見られます' using errcode = 'P0001', hint = 'not_admin';
  end if;
  select s.anonymous into anon from public.surveys s where s.id = p_survey;
  return query
    select a.question_id, a.text_value,
           case when anon then null else p.full_name end,
           case when anon then null else o.name end
    from public.survey_answers a
    join public.survey_responses r on r.id = a.response_id
    join public.profiles p on p.id = r.user_id
    left join public.offices o on o.id = p.office_id
    where r.survey_id = p_survey and a.text_value is not null
    order by case when anon then random() else extract(epoch from r.submitted_at) end;
end;
$$;
revoke execute on function public.survey_choice_counts(uuid) from public, anon;
revoke execute on function public.survey_text_answers(uuid) from public, anon;
grant execute on function public.survey_choice_counts(uuid) to authenticated;
grant execute on function public.survey_text_answers(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 11. いいね
-- ---------------------------------------------------------------------
-- いいね（お知らせ・アンケートに、1人1回）
create table if not exists public.post_likes (
  target_type text not null check (target_type in ('notice', 'survey')),
  target_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (target_type, target_id, user_id)
);
create index if not exists post_likes_target_idx on public.post_likes (target_type, target_id);

alter table public.post_likes enable row level security;

-- 見る：自分のいいねは本人が、だれがいいねしたかは管理者が見られる（数はみんな、下の仕組みで見る）
drop policy if exists "post_likes_select" on public.post_likes;
create policy "post_likes_select" on public.post_likes for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 付ける：利用中の社員が、自分の分だけ、見られる投稿にだけ
drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own" on public.post_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_member()
    and (
      (target_type = 'notice' and exists (select 1 from public.notices n where n.id = target_id))
      or (target_type = 'survey' and exists (select 1 from public.surveys s where s.id = target_id))
    )
  );

-- 外す：自分の分だけ
drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own" on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.post_likes to authenticated;
revoke all on public.post_likes from anon;

-- いいねの数（ログインした社員ならだれでも見られる。だれが押したかは出さない）
create or replace function public.post_like_counts(p_type text, p_ids uuid[])
returns table (target_id uuid, likes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_active_member() or public.is_admin()) then
    return;
  end if;
  return query
    select l.target_id, count(*)
    from public.post_likes l
    where l.target_type = p_type and l.target_id = any (p_ids)
    group by l.target_id;
end;
$$;
revoke execute on function public.post_like_counts(text, uuid[]) from public, anon;
grant execute on function public.post_like_counts(text, uuid[]) to authenticated;

-- お知らせ・アンケートを完全に削除したら、そのいいねも消す
create or replace function public.delete_likes_of_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.post_likes where target_type = tg_argv[0] and target_id = old.id;
  return old;
end;
$$;

drop trigger if exists notices_delete_likes on public.notices;
create trigger notices_delete_likes after delete on public.notices
  for each row execute function public.delete_likes_of_target('notice');
drop trigger if exists surveys_delete_likes on public.surveys;
create trigger surveys_delete_likes after delete on public.surveys
  for each row execute function public.delete_likes_of_target('survey');

-- ---------------------------------------------------------------------
-- 12. 情報集
-- ---------------------------------------------------------------------
-- ジャンル（管理者が追加・名前の変更・並べ替えをできる）
create table if not exists public.library_genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.library_genres (name, sort_order)
select v.name, v.sort_order
from (values
  ('安全・事故防止', 1),
  ('車両・点検', 2),
  ('荷扱い・積み込み', 3),
  ('構内・物流センターのルール', 4),
  ('就業規則・総務', 5),
  ('研修・教育', 6)
) as v(name, sort_order)
where not exists (select 1 from public.library_genres);

-- 資料
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  genre_id uuid not null references public.library_genres (id),
  title text not null,
  body text,
  photo_paths text[] not null default '{}',
  pdf_path text,
  pdf_name text,
  -- 内容を「更新」として知らせた日時。これより前に開いた人には「更新」の印が付く
  content_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  hidden_at timestamptz,
  is_dummy boolean not null default false
);
create index if not exists library_items_genre_idx on public.library_items (genre_id);

-- 開いた記録（最後に開いた日時。最新の内容を見たかどうかの判定に使う）
create table if not exists public.library_views (
  item_id uuid not null references public.library_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index if not exists library_views_user_idx on public.library_views (user_id);

-- ---------------------------------------------------------------------
-- 権限設定
-- ---------------------------------------------------------------------
alter table public.library_genres enable row level security;
alter table public.library_items enable row level security;
alter table public.library_views enable row level security;

drop policy if exists "library_genres_select" on public.library_genres;
create policy "library_genres_select" on public.library_genres for select to authenticated
  using (public.is_active_member() or public.is_admin());
drop policy if exists "library_genres_admin_write" on public.library_genres;
create policy "library_genres_admin_write" on public.library_genres for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "library_items_select" on public.library_items;
create policy "library_items_select" on public.library_items for select to authenticated
  using ((public.is_active_member() and hidden_at is null) or public.is_admin());
drop policy if exists "library_items_admin_insert" on public.library_items;
create policy "library_items_admin_insert" on public.library_items for insert to authenticated with check (public.is_admin());
drop policy if exists "library_items_admin_update" on public.library_items;
create policy "library_items_admin_update" on public.library_items for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "library_items_admin_delete" on public.library_items;
create policy "library_items_admin_delete" on public.library_items for delete to authenticated
  using (public.is_admin() and hidden_at is not null);

-- 開いた記録：本人は自分の分を付けられる・見られる。管理者は全員分を見られる
drop policy if exists "library_views_select" on public.library_views;
create policy "library_views_select" on public.library_views for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "library_views_insert_own" on public.library_views;
create policy "library_views_insert_own" on public.library_views for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_member()
              and exists (select 1 from public.library_items i where i.id = item_id));
drop policy if exists "library_views_update_own" on public.library_views;
create policy "library_views_update_own" on public.library_views for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.library_genres, public.library_items to authenticated;
grant select, insert, update on public.library_views to authenticated;
revoke all on public.library_genres, public.library_items, public.library_views from anon;

-- ---------------------------------------------------------------------
-- 写真・PDF の置き場所（非公開。1ファイル20MBまで。写真とPDFだけ）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-files', 'library-files', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "library_files_select" on storage.objects;
create policy "library_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'library-files' and (public.is_active_member() or public.is_admin()));
drop policy if exists "library_files_admin_insert" on storage.objects;
create policy "library_files_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'library-files' and public.is_admin());
drop policy if exists "library_files_admin_update" on storage.objects;
create policy "library_files_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'library-files' and public.is_admin());
drop policy if exists "library_files_admin_delete" on storage.objects;
create policy "library_files_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'library-files' and public.is_admin());

-- ---------------------------------------------------------------------
-- 13. Instagram の投稿
-- ---------------------------------------------------------------------
create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  -- 投稿の種類（p＝写真の投稿、reel＝リール、tv＝動画）と、投稿の番号（アドレスの最後の部分）
  kind text not null check (kind in ('p', 'reel', 'tv')),
  shortcode text not null unique check (shortcode ~ '^[A-Za-z0-9_-]{5,64}$'),
  -- タイムラインで投稿の上に出すひとこと（なくてもよい）
  note text check (note is null or char_length(note) <= 500),
  published_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  hidden_at timestamptz,
  is_dummy boolean not null default false
);
create index if not exists instagram_posts_published_idx on public.instagram_posts (published_at desc);

alter table public.instagram_posts enable row level security;

-- 見る：利用中の社員は表示中のものだけ、管理者はすべて
drop policy if exists "instagram_posts_select" on public.instagram_posts;
create policy "instagram_posts_select" on public.instagram_posts for select to authenticated
  using ((public.is_active_member() and hidden_at is null) or public.is_admin());
-- 載せる・非表示にする：管理者だけ
drop policy if exists "instagram_posts_admin_insert" on public.instagram_posts;
create policy "instagram_posts_admin_insert" on public.instagram_posts for insert to authenticated
  with check (public.is_admin());
drop policy if exists "instagram_posts_admin_update" on public.instagram_posts;
create policy "instagram_posts_admin_update" on public.instagram_posts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- 完全削除：管理者が、非表示にしたものだけ
drop policy if exists "instagram_posts_admin_delete" on public.instagram_posts;
create policy "instagram_posts_admin_delete" on public.instagram_posts for delete to authenticated
  using (public.is_admin() and hidden_at is not null);

grant select, insert, update, delete on public.instagram_posts to authenticated;
revoke all on public.instagram_posts from anon;

-- ---------------------------------------------------------------------
-- 「いいね」を Instagram の投稿にも付けられるようにする
-- ---------------------------------------------------------------------
alter table public.post_likes drop constraint if exists post_likes_target_type_check;
alter table public.post_likes add constraint post_likes_target_type_check
  check (target_type in ('notice', 'survey', 'instagram'));

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own" on public.post_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_member()
    and (
      (target_type = 'notice' and exists (select 1 from public.notices n where n.id = target_id))
      or (target_type = 'survey' and exists (select 1 from public.surveys s where s.id = target_id))
      or (target_type = 'instagram' and exists (select 1 from public.instagram_posts i where i.id = target_id))
    )
  );

-- 完全に削除したら、そのいいねも消す
drop trigger if exists instagram_posts_delete_likes on public.instagram_posts;
create trigger instagram_posts_delete_likes after delete on public.instagram_posts
  for each row execute function public.delete_likes_of_target('instagram');

-- ---------------------------------------------------------------------
-- 14. 情報集の確認ボタン
-- ---------------------------------------------------------------------
-- 資料ごとに「確認ボタンを付ける」かどうか
alter table public.library_items add column if not exists requires_confirm boolean not null default false;

-- 確認した日時（最新の内容＝「更新」として知らせた日時より後に確認したかで判定する）
alter table public.library_views add column if not exists confirmed_at timestamptz;

-- 確認した日時は本人が書き換えられないようにする（下の仕組みを通してだけ付ける）
revoke insert, update on public.library_views from authenticated;
grant insert (item_id, user_id, viewed_at) on public.library_views to authenticated;
-- （upsert で item_id・user_id も同じ値で書き直すため、この3つは更新を許す。本人の行だけ）
grant update (item_id, user_id, viewed_at) on public.library_views to authenticated;

-- 「内容を確認しました」：本人の分だけ、今の日時で記録する
create or replace function public.confirm_library_item(p_item_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'not allowed';
  end if;
  if not exists (
    select 1 from public.library_items i
    where i.id = p_item_id and i.hidden_at is null and i.requires_confirm
  ) then
    raise exception 'not found';
  end if;
  insert into public.library_views (item_id, user_id, viewed_at, confirmed_at)
  values (p_item_id, auth.uid(), v_now, v_now)
  on conflict (item_id, user_id) do update set viewed_at = v_now, confirmed_at = v_now;
  return v_now;
end;
$$;
revoke execute on function public.confirm_library_item(uuid) from public, anon;
grant execute on function public.confirm_library_item(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 15. 今日の配車（配車表のPDF）
-- ---------------------------------------------------------------------
create table if not exists public.dispatch_sheets (
  id uuid primary key default gen_random_uuid(),
  -- 何日分の配車表か（日本の日付）。1日に1つ。載せ直すと差し替え
  sheet_date date not null unique,
  pdf_path text not null,
  pdf_name text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.dispatch_sheets enable row level security;

-- 見る：利用中の社員と管理者
drop policy if exists "dispatch_sheets_select" on public.dispatch_sheets;
create policy "dispatch_sheets_select" on public.dispatch_sheets for select to authenticated
  using (public.is_active_member() or public.is_admin());
-- 載せる・差し替える・消す：管理者だけ
drop policy if exists "dispatch_sheets_admin_write" on public.dispatch_sheets;
create policy "dispatch_sheets_admin_write" on public.dispatch_sheets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.dispatch_sheets to authenticated;
revoke all on public.dispatch_sheets from anon;

-- ---------------------------------------------------------------------
-- PDF の置き場所（非公開。1ファイル20MBまで。PDFだけ）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispatch-files', 'dispatch-files', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dispatch_files_select" on storage.objects;
create policy "dispatch_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'dispatch-files' and (public.is_active_member() or public.is_admin()));
drop policy if exists "dispatch_files_admin_insert" on storage.objects;
create policy "dispatch_files_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'dispatch-files' and public.is_admin());
drop policy if exists "dispatch_files_admin_update" on storage.objects;
create policy "dispatch_files_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'dispatch-files' and public.is_admin());
drop policy if exists "dispatch_files_admin_delete" on storage.objects;
create policy "dispatch_files_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'dispatch-files' and public.is_admin());
