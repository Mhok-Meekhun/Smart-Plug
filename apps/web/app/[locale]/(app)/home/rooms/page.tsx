import { getTranslations } from "next-intl/server";
import { HomeRoomManager } from "../../../../../components/home-room-manager";
import { SettingsNav } from "../../../../../components/settings-nav";

export default async function RoomsPage() {
  const t = await getTranslations("HomeRooms");
  return <main className="mx-auto max-w-5xl px-5 py-8 md:px-8 lg:px-10 lg:py-12"><SettingsNav/><div className="mb-7 max-w-3xl"><p className="text-xs font-bold tracking-[.16em] text-[#238e41]">{t("eyebrow")}</p><h1 className="mt-3 text-3xl font-black tracking-[-.04em] md:text-5xl">{t("title")}</h1><p className="mt-4 text-sm leading-7 text-[#68736a] md:text-base">{t("subtitle")}</p></div><HomeRoomManager/></main>;
}
