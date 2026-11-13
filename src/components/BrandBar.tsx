import { Logo } from "./Logo";

/** 画面の一番上の細いマルーンの帯（左にロゴ）と、その下のゴールドの線 */
export function BrandBar() {
  return (
    <div>
      <div className="bg-primary">
        <div className="mx-auto flex h-10 max-w-2xl items-center px-4">
          <Logo />
        </div>
      </div>
      <div className="h-[3px] bg-gold-line" />
    </div>
  );
}
