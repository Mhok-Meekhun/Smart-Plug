import { Fan, LampFloor, PlugZap, Refrigerator, Tv, Zap } from "lucide-react";

export function ApplianceIcon({ name, size = 23 }: { name: string; size?: number }) {
  const Icon = /\b(tv|television)\b|ทีวี|โทรทัศน์/i.test(name) ? Tv
    : /\bfan\b|พัดลม/i.test(name) ? Fan
    : /\b(lamp|light)\b|โคม|ไฟส่อง/i.test(name) ? LampFloor
    : /\b(fridge|refrigerator)\b|ตู้เย็น/i.test(name) ? Refrigerator
    : /\bkettle\b|กาต้มน้ำ/i.test(name) ? Zap
    : PlugZap;
  return <Icon size={size} aria-hidden="true" />;
}
