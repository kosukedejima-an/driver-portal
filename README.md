# ドライバーポータル

運送会社のドライバー向けの、**スマホで使える社内アプリ**です。
本社からのお知らせ・事故速報・配車表・アンケート・マニュアルを、ドライバーのスマホに届けられます。

無料で使えて、自由に作り替えられます（MIT ライセンス）。

## できること

| 機能 | 中身 |
| --- | --- |
| お知らせ・事故速報 | 本社から投稿。ドライバーは「内容を確認しました」を押す。管理者はだれが確認したか（営業所別・未確認者）を見られる |
| 今日の配車 | 1週間分の配車表（PDF）を日付ごとに載せる。押すと開く |
| アンケート | 1つ選ぶ・いくつでも選ぶ・自由に書く。無記名もできる。回答率と未回答者が分かる |
| 情報集 | マニュアルや規則などの資料をジャンル別に置く。大事な資料には「確認ボタン」も付けられる |
| タイムライン | お知らせ・アンケート・会社の Instagram の投稿を新しい順に表示。「いいね」が付けられる |
| プッシュ通知 | 新しい投稿や配車表を、スマホに通知（ホーム画面に追加したアプリ） |
| 社員管理 | 営業所ごとの管理、CSV でまとめて登録、退職（利用停止）、変更の記録 |
| 事故報告書の読み取り（任意） | 事故報告書の画像・PDFを AI で読み取り、事故速報の下書きを作る（鍵を登録したときだけ） |

- ドライバーは**社員番号だけ**でログイン。管理者は社員番号とパスワード
- スマホで見やすく、文字は大きめ、ボタンは押しやすい大きさ
- 管理者画面は、パソコンの広い画面にも合わせて表示

## はじめ方

パソコンとメールアドレスがあれば、30分〜1時間で始められます。
→ **[導入の手順](./docs/setup.md)**

### AI に任せて導入する（おすすめ）

[AI_SETUP.md](./AI_SETUP.md) を Claude などの AI に渡して、「**このファイルの手順で、ドライバーポータルの導入を手伝ってください**」と頼んでください。
AI が質問しながら一歩ずつ案内します。Supabase のコネクタを入れた AI なら、データベースの設定も代わりに入れます。

### ボタンで公開する

Supabase のプロジェクトを作り、`supabase/setup.sql` を実行したら、このボタンで Vercel に公開できます（自分用のコピー作りと公開をまとめて行います）。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkosukedejima-an%2Fdriver-portal&project-name=driver-portal&repository-name=driver-portal&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY&envDescription=Supabase%20%E3%81%AE%20Project%20Settings%20%E2%86%92%20API%20Keys%20%E3%81%AB%E3%81%82%E3%82%8B%E5%80%A4%E3%82%92%E5%85%A5%E3%82%8C%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%EF%BC%88service_role%20%E3%81%AF%E7%A7%98%E5%AF%86%E3%81%AE%E3%82%AD%E3%83%BC%EF%BC%89&envLink=https%3A%2F%2Fgithub.com%2Fkosukedejima-an%2Fdriver-portal%2Fblob%2Fmain%2Fdocs%2Fsetup.md)

1. Supabase（データの置き場所）を作り、`supabase/setup.sql` を1回実行する
2. Vercel（アプリを動かす場所）に、このプログラムを公開する
3. アプリの `/setup` で、最初の管理者を登録する

## 自分の会社に合わせる

アプリの名前・会社名・ロゴは `src/config/site.ts` の1か所で変えられます。色やアイコンの変え方も含めて、
→ **[カスタマイズの手引き](./docs/customize.md)**

AI（Claude Code など）に手伝ってもらうときは、作りと決まりごとをまとめた [CLAUDE.md](./CLAUDE.md) を最初に読ませてください。

## 使っている仕組み

- [Next.js](https://nextjs.org)（アプリの土台）・TypeScript・Tailwind CSS
- [Supabase](https://supabase.com)（データベース・ログイン・ファイルの置き場所）
- [Vercel](https://vercel.com)（公開する場所。ほかのサーバーでも動かせます）

パソコンで動かして確かめるときは、Node.js（20以上）を入れて `npm install` → `.env.example` を `.env.local` にコピーして値を入れる → `npm run dev` で、http://localhost:3000 を開きます。

## 大事なこと

- ドライバーは社員番号だけで入れる作りです。**社員番号を社外に出さない**ようにしてください
- 見られる範囲はデータベースの権限設定（RLS）で守っています。作り替えるときも、画面側のチェックだけに頼らないでください
- このプログラムは「現状のまま」提供します。使ったことで生じた損害について、作った人は責任を負いません（[LICENSE](./LICENSE)）

## 改良・不具合の報告

不具合の報告や改良の提案は、GitHub の「Issues」へ。直したプログラムを送っていただく「Pull request」も歓迎します。

## ライセンス

[MIT License](./LICENSE)
