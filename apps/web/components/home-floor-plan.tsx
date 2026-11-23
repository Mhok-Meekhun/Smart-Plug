import { ArrowUpRight, Grid2X2, House } from "lucide-react";
import { Link } from "../i18n/navigation";
import { roomKind, roomName, type RoomSummary } from "../lib/rooms";
import { ApplianceIcon } from "./appliance-icon";

export type FloorDevice = {
  id: string;
  name: string;
  roomId: string | null;
  state: { connectionStatus: string; relayState: boolean; powerW: number | null } | null;
};

export function HomeFloorPlan({ rooms, devices, locale }: {
  rooms: RoomSummary[];
  devices: FloorDevice[];
  locale: string;
}) {
  const thai = locale === "th";
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const roomIds = new Set(rooms.map(({ id }) => id));
  const unassigned = devices.filter(({ roomId }) => !roomId || !roomIds.has(roomId));
  const sections = rooms.map((room) => ({
    id: room.id,
    name: roomName(room, locale),
    kind: roomKind(room),
    devices: devices.filter(({ roomId }) => roomId === room.id),
  }));

  return (
    <section className="panel floor-plan-panel mt-6 p-4 sm:p-6" aria-labelledby="floor-plan-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="device-icon" aria-hidden="true"><Grid2X2 size={22} /></span>
          <div>
            <h2 id="floor-plan-title" className="text-xl font-black sm:text-2xl">{thai ? "ผังบ้าน" : "Home floor plan"}</h2>
            <p className="mt-1 text-xs text-[#5d6b71]">
              {thai ? "มุมมองด้านบน · แตะอุปกรณ์เพื่อดูและควบคุม" : "Top view · Select an appliance to view and control it"}
            </p>
          </div>
        </div>
        <Link href="/home/rooms" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#e2f0f5] px-3 text-sm font-bold text-[#315f72]">
          {thai ? "จัดการห้อง" : "Manage rooms"} <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="floor-plan-key">
        <span><i data-state="active" />{thai ? "เปิด" : "On"}</span>
        <span><i data-state="off" />{thai ? "ปิด" : "Off"}</span>
        <span><i data-state="offline" />{thai ? "ออฟไลน์" : "Offline"}</span>
      </div>
      {sections.length > 0 ? (
        <div className="floor-plan-grid">
          {sections.map((room) => (
            <section key={room.id} className="floor-room" data-room={room.kind}>
              <div className="room-furniture" aria-hidden="true"><span /><span /><span /></div>
              <div className="floor-room-heading">
                <h3><Link href={{ pathname: "/devices", query: { room: room.id } }}>{room.name}</Link></h3>
                <small>{room.devices.length} {thai ? "เครื่อง" : "devices"}</small>
              </div>
              {room.devices.length ? <ul className="floor-device-list">
                {room.devices.map((device) => <FloorDeviceItem key={device.id} device={device} thai={thai} formatter={formatter} />)}
              </ul> : <p className="floor-room-empty">{thai ? "ยังไม่มีอุปกรณ์" : "No appliances yet"}</p>}
            </section>
          ))}
        </div>
      ) : <p className="rounded-2xl border border-dashed border-[#b5ced8] p-6 text-sm text-[#5d6b71]">
        <House className="mr-2 inline" size={18} aria-hidden="true" />
        {thai ? "เพิ่มห้องเพื่อเริ่มจัดผังบ้าน" : "Add rooms to lay out your home"}
      </p>}
      {unassigned.length > 0 && <section className="mt-4 rounded-2xl border border-[#d7e5eb] p-4">
        <h3 className="mb-2 font-bold">{thai ? "ยังไม่ระบุห้อง" : "Unassigned appliances"}</h3>
        <ul className="floor-device-list">
          {unassigned.map((device) => <FloorDeviceItem key={device.id} device={device} thai={thai} formatter={formatter} />)}
        </ul>
      </section>}
      <p className="mt-3 text-xs text-[#5d6b71]">{thai ? "ผังแสดงการจัดกลุ่มตามห้อง ขนาดและตำแหน่งเป็นภาพประกอบ" : "Schematic room layout. Positions and dimensions are illustrative."}</p>
    </section>
  );
}

function FloorDeviceItem({ device, thai, formatter }: {
  device: FloorDevice;
  thai: boolean;
  formatter: Intl.NumberFormat;
}) {
  const online = device.state?.connectionStatus === "ONLINE";
  const active = online && device.state?.relayState;
  const status = online ? active ? (thai ? "เปิด" : "On") : (thai ? "ปิด" : "Off") : (thai ? "ออฟไลน์" : "Offline");
  return (
    <li>
      <Link href={`/devices/${device.id}`} className="floor-device" aria-label={`${device.name} · ${status}`}>
        <ApplianceIcon name={device.name} size={42} />
        <span className="min-w-0">
          <strong>{device.name}</strong>
          <small><i data-state={online ? active ? "active" : "off" : "offline"} />{status}
            {online && device.state?.powerW != null ? ` · ${formatter.format(device.state.powerW)} W` : ""}
          </small>
        </span>
      </Link>
    </li>
  );
}
