import { getTranslations } from "next-intl/server";
import { TariffSettings } from "../../../../../components/tariff-settings";

export default async function ElectricityPage() {
  const t = await getTranslations("Tariff");
  return <main className="mx-auto max-w-5xl px-5 py-8 md:px-8 lg:px-10 lg:py-12"><div className="mb-7 max-w-3xl"><p className="text-xs font-bold tracking-[.16em] text-[#238e41]">{t("eyebrow")}</p><h1 className="mt-3 text-3xl font-black tracking-[-.04em] md:text-5xl">{t("title")}</h1><p className="mt-4 text-sm leading-7 text-[#68736a] md:text-base">{t("subtitle")}</p></div><TariffSettings /></main>;
}
