import { getTranslations } from "next-intl/server";
import { SectionPage } from "../../../../../components/section-page";
export default async function RoomsPage(){const t=await getTranslations("Pages");return <SectionPage title={t("devicesTitle")} body={t("devicesBody")} coming={t("coming")}/>;}
