import { getTranslations } from "next-intl/server";
import { ProvisioningWizard } from "../../../../../components/provisioning-wizard";

export default async function AddDevicePage() {
  const t = await getTranslations("Provisioning");
  return <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 lg:px-10 lg:py-12"><div className="mb-7 max-w-3xl"><p className="text-xs font-bold tracking-[.16em] text-[#376d81]">{t("eyebrow")}</p><h1 className="mt-3 text-3xl font-black tracking-[-.04em] md:text-5xl">{t("title")}</h1><p className="mt-4 text-sm leading-7 text-[#5d6b71] md:text-base">{t("subtitle")}</p></div><ProvisioningWizard /></main>;
}
