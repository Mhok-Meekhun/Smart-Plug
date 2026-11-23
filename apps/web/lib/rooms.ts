export type RoomSummary = { id: string; name: string; icon?: string | null };

const categories = [
  { key: "living", th: "ห้องนั่งเล่น", en: "Living room", pattern: /living|sofa|นั่งเล่น|รับแขก/i },
  { key: "bedroom", th: "ห้องนอน", en: "Bedroom", pattern: /bedroom|\bbed\b|ห้องนอน/i },
  { key: "kitchen", th: "ห้องครัว", en: "Kitchen", pattern: /kitchen|cooking|ครัว/i },
  { key: "bathroom", th: "ห้องน้ำ", en: "Bathroom", pattern: /bath|toilet|ห้องน้ำ/i },
  { key: "dining", th: "ห้องรับประทานอาหาร", en: "Dining room", pattern: /dining|กินข้าว|รับประทาน/i },
  { key: "laundry", th: "ห้องซักล้าง", en: "Laundry room", pattern: /laundry|utility|ซักล้าง|ซักผ้า/i },
] as const;

export type RoomKind = typeof categories[number]["key"] | "other";
export const roomCategories = categories;

export function roomKind(room: Pick<RoomSummary, "name" | "icon">): RoomKind {
  return categories.find((category) => room.icon === category.key)?.key
    ?? categories.find((category) => category.pattern.test(room.name))?.key
    ?? "other";
}

export function roomName(room: Pick<RoomSummary, "name">, locale: string): string {
  const category = categories.find(({ en, th }) => en.toLowerCase() === room.name.toLowerCase() || th === room.name);
  return category ? (locale === "th" ? category.th : category.en) : room.name;
}
