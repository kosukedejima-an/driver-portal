import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/format";
import { getLibraryItem } from "@/lib/library";
import { LibraryConfirmButton } from "./LibraryConfirmButton";
import { RecordView } from "./RecordView";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function LibraryDetail({ params }: { params: PageProps<"/library/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const data = await getLibraryItem(id);
  if (!data) notFound();
  const { item, confirmed, genreName, photoUrls, pdfUrl, pdfDownloadUrl } = data;
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      {!item.hidden_at && <RecordView itemId={item.id} />}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">{genreName}</span>
        <span className="text-sm text-gray-600">{formatDate(item.content_updated_at)} 更新</span>
        {item.is_dummy && <DummyBadge />}
      </div>
      {item.requires_confirm && !confirmed && !item.hidden_at && (
        <p className="mt-2 text-base font-bold text-unread">● 読んだら、下の「内容を確認しました」を押してください</p>
      )}
      <h2 className="mt-3 text-xl font-bold leading-snug">{item.title}</h2>
      {item.hidden_at && <p className="mt-2 rounded bg-gray-100 p-2 text-base">この資料は非表示中のため、ドライバーには表示されていません。</p>}
      {item.body && <p className="mt-4 text-base leading-relaxed whitespace-pre-wrap">{item.body}</p>}
      {photoUrls.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- 期限付きURLの写真のため通常の img を使う
            <img key={i} src={url} alt={`写真${i + 1}`} loading="lazy" className="w-full rounded-lg" />
          ))}
        </div>
      )}
      {pdfUrl && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white"
          >
            PDFを開く
          </a>
          {pdfDownloadUrl && (
            <a href={pdfDownloadUrl} className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary text-base font-bold text-primary">
              保存する
            </a>
          )}
        </div>
      )}
      {item.pdf_name && <p className="mt-1 text-sm text-gray-600">{item.pdf_name}</p>}
      {item.requires_confirm && !item.hidden_at && <LibraryConfirmButton itemId={item.id} confirmed={confirmed} />}
    </article>
  );
}

export default function LibraryDetailPage({ params }: PageProps<"/library/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="情報集" backHref="/library" backToPrevious />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-10">
        <Suspense fallback={<Loading />}>
          <LibraryDetail params={params} />
        </Suspense>
      </main>
    </div>
  );
}
