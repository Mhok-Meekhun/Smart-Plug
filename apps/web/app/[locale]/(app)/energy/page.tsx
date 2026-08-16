import { getTranslations } from "next-intl/server";
import { SectionPage } from "../../../../components/section-page";
export default async function EnergyPage(){const t=await getTranslations("Pages");return <SectionPage title={t("energyTitle")} body={t("energyBody")} coming={t("coming")}/>;}
