import type { Category } from "@/lib/types";

export function CategoryBadge({ category }: { category: Category }) {
  const isAccident = category === "事故速報";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-sm font-bold ${
        isAccident ? "bg-primary text-white" : "bg-primary/10 text-primary"
      }`}
    >
      {category}
    </span>
  );
}
