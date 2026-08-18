import { redirect } from "../../../../../i18n/navigation";

export default async function RoomsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/devices/add", locale });
}
