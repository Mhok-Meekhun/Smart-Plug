import { getTranslations } from "next-intl/server";
import { SectionPage } from "../../../../../components/section-page";
export default async function SettingsPage(){const t=await getTranslations("Pages");return <SectionPage title={t("settingsTitle")} body={t("settingsBody")} coming={t("coming")}/>;}
