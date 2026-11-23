import { DeviceList } from "../../../../components/device-list";

export default async function DevicesPage({ searchParams }: {
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  const { room } = await searchParams;
  const roomId = typeof room === "string" ? room : "";
  return <DeviceList key={roomId} initialRoomId={roomId} />;
}
