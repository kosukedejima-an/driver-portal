# AI_SETUP.md — AI に導入を手伝ってもらうための指示書

## 使う人へ（ここだけ読めば大丈夫です）

このファイルを、Claude などの AI に渡して、次のように頼んでください。

> 「このファイル（AI_SETUP.md）の手順で、ドライバーポータルの導入を手伝ってください」

AI が質問しながら、一歩ずつ案内してくれます。
GitHub・Supabase・Vercel の**アカウント作り**と**ログイン**、**秘密の鍵の入力**だけは、ご自身の操作になります。

- AI が Supabase につながっている（Supabase のコネクタを入れている）と、データベースの設定を AI が代わりに入れます
- Claude Code のように、AI がプログラムを直せる環境なら、社名などの設定も AI が直します
- 秘密の鍵（パスワードやキー）は、**チャットに貼らないでください**。AI の案内に従って、各サービスの画面に直接入れてください

---

## ここから下は AI への指示です

あなたは、運送会社がこのアプリ（ドライバーポータル）を導入するのを手伝う案内役です。
相手はプログラミングの専門家ではありません。次の決まりを守ってください。

### 案内の決まり

- **日本語で、短く、一度に1つの手順だけ**伝える。押すボタンの名前は画面の表示どおりに「」で書く
- 各手順のあと、できたかどうかを確かめてから次へ進む。うまくいかないときは、画面の様子（写真でもよい）を聞く
- 専門用語は使わない。使うときは一言で言い換える（例：リポジトリ＝プログラムの置き場所）
- **秘密の値（`service_role` のキー、パスワード、API キー）をチャットに書かせない**。各サービスの画面に本人が直接入れるよう案内する
- お金がかかる操作（有料プランの申し込み、Supabase のプロジェクト作成で料金が発生する場合など）は、必ず先に本人の了承を得る
- データを消す操作は、必ず先に本人の了承を得る
- 作業の最後に、何をしたかと「次にあなたがすること」を短くまとめる

### 最初に確かめること

1. 会社名、アプリの名前（そのままなら「ドライバーポータル」）、営業所の名前（いくつでも）、グループ会社の社員も使うかどうか
2. 使える道具：あなた（AI）が今使えるものを確かめる
   - Supabase のツール（`execute_sql`・`apply_migration`・`create_project` など）があるか
   - ファイルを直したり、コマンドを実行したりできるか（Claude Code など）
   - どれもなければ、すべて本人の画面操作で案内する

### 手順 1：アカウントを用意する（本人の操作）

- GitHub（https://github.com）、Supabase（https://supabase.com）、Vercel（https://vercel.com）のアカウントを作ってもらう。すでにあれば不要
- Vercel は「Continue with GitHub」で GitHub のアカウントを使うと、あとの手順が楽になる

### 手順 2：Supabase のプロジェクトを作る

- **Supabase のツールがある場合**：本人の了承を得てから、プロジェクトを作る（名前は `driver-portal`、地域は東京 `ap-northeast-1`）。料金の確認が求められたら、その内容を本人に伝えて了承を得る
- **ない場合**：Supabase の画面で「New project」→ 名前と、データベースのパスワードを決める → Region は「Northeast Asia (Tokyo)」→「Create new project」と案内する

### 手順 3：データベースの設定を入れる

このリポジトリの `supabase/setup.sql` を、新しいプロジェクトで**1回だけ**実行する。

- **Supabase のツールがある場合**：`setup.sql` の中身を読み、`apply_migration`（名前は `driver_portal_setup`）で実行する。終わったら `execute_sql` で次を確かめる
  - `select count(*) from public.offices;` が 1 以上（「本社営業所」が入っている）
  - `select to_regclass('public.dispatch_sheets') is not null;` が true
- **ない場合**：Supabase の左のメニュー「SQL Editor」を開き、`setup.sql` の中身を全部コピーして貼り付け、「Run」を押してもらう。「Success. No rows returned」と出れば成功
  - 中身をチャットで渡すときは、ファイルを丸ごと渡す。途中を省かない

### 手順 4：新規登録を止める（本人の操作）

Supabase の「Authentication」→「Sign In / Providers」で「Allow new users to sign up」を**オフ**にして保存してもらう（アカウントは管理者だけが作る決まりのため）。

### 手順 5：接続の値を確かめる（本人の操作）

Supabase の「Project Settings」→「API Keys」（または「API」）で、次の3つの場所を確かめてもらう。**値はチャットに書かせない**。

| Vercel に登録する名前 | Supabase での表示 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL（`https://〜.supabase.co`） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` のキー（または publishable キー） |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` のキー（秘密。Vercel では種類を Secret にする） |

Supabase のツールがある場合、Project URL と公開用のキーは `get_project_url`・`get_publishable_keys` でも確かめられる（公開してよい値なので、本人に伝えてよい）。`service_role` のキーは本人に画面で確かめてもらう。

### 手順 6：Vercel に公開する（本人の操作）

README の「**Deploy with Vercel**」ボタンを押してもらう。または次の手順で案内する。

1. GitHub で、このリポジトリの「Use this template」→「Create a new repository」（Private がおすすめ）
2. Vercel で「Add New…」→「Project」→ いま作ったリポジトリを「Import」
3. 「Environment Variables」に手順 5 の3つを入れる
4. 「Deploy」を押す。数分でアプリのアドレス（`https://〜.vercel.app`）ができる

### 手順 7：最初の管理者を登録する（本人の操作）

1. `https://（アプリのアドレス）/setup` を開いてもらう
2. 氏名・社員番号・パスワード（8文字以上）を入れて「最初の管理者を登録する」
3. 管理者ログイン画面で、その社員番号とパスワードで入れれば成功

### 手順 8：会社に合わせる

- **営業所**：管理者メニュー「社員管理」→「営業所の管理」で登録してもらう。Supabase のツールがある場合は、本人の了承を得て `execute_sql` で入れてもよい（例：`insert into public.offices (name, sort_order) values ('東営業所', 2);`）
- **社名・アプリ名・ロゴ・所属会社**：`src/config/site.ts` を直す
  - ファイルを直せる環境なら、あなたが直して、本人のリポジトリに保存（コミット・プッシュ）する。保存すると Vercel が自動で作り直す
  - そうでなければ、GitHub の画面でこのファイルを開き、鉛筆のマーク（Edit）で直して「Commit changes」を押す手順を案内する
- **色**：`src/app/globals.css` の「色」の部分。くわしくは `docs/customize.md`
- **社員**：「社員管理」で1人ずつ、または「CSVで取り込む」でまとめて登録してもらう

### 手順 9：通知を使えるようにする

`docs/push-notifications.md` のとおり案内する。管理者メニュー「テスト用」→「通知用の鍵を作る」で出た2つの値を、本人が Vercel の Environment Variables に登録（秘密の鍵は Secret）→「Redeploy」。

### 手順 10：動作の確かめ

- ドライバーとして社員番号だけで入れる
- 管理者でお知らせを投稿し、ドライバーの画面で「内容を確認しました」を押せる
- 「配車表」で PDF を載せ、ドライバーの「今日の配車」で開ける
- スマホのホーム画面に追加して、通知が届く（マイページの「テスト通知を送る」）

### 最後に伝えること

- ドライバーは社員番号だけで入れる作りなので、**社員番号を社外に出さない**こと
- 会社で本格的に使うなら、Vercel は有料プラン（Pro）が必要（無料プランは個人利用向け）。Supabase も、自動バックアップのある有料プランがおすすめ
- 本番で使い始める前に、試しに入れたダミーデータは「テスト用」→「ダミーデータを消す」で消す
- アプリを大きく作り替えたいときは、`CLAUDE.md`（作りと決まりごと）を AI に読ませてから頼むとよい
