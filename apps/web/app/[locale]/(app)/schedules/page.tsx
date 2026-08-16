import { getTranslations } from "next-intl/server";
import { SectionPage } from "../../../../components/section-page";
export default async function SchedulesPage(){const t=await getTranslations("Pages");return <SectionPage title={t("schedulesTitle")} body={t("schedulesBody")} coming={t("coming")}/>;}
