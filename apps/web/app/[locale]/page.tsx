import { redirect } from "next/navigation";
import { routing, type AppLocale } from "../../i18n/routing";

type LocaleHomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const { locale } = await params;
  const destinationLocale: AppLocale = routing.locales.includes(locale as AppLocale)
    ? (locale as AppLocale)
    : routing.defaultLocale;

  redirect(`/${destinationLocale}/dashboard`);
}
