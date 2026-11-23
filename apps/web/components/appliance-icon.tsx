const appliances = [
  /\b(tv|television)\b|ทีวี|โทรทัศน์/i,
  /\bfan\b|พัดลม/i,
  /\b(lamp|light)\b|โคม|ไฟส่อง/i,
  /\b(fridge|refrigerator)\b|ตู้เย็น/i,
  /\bkettle\b|กาต้มน้ำ/i,
  /washing machine|\bwasher\b|เครื่องซักผ้า/i,
  /air[ -]?conditioner|\b(a\/?c)\b|แอร์|เครื่องปรับอากาศ/i,
  /microwave|ไมโครเวฟ/i,
];

export function ApplianceIcon({ name, size = 52 }: { name: string; size?: number }) {
  const match = appliances.findIndex((pattern) => pattern.test(name));
  const cell = match < 0 ? 8 : match;
  return <span
    className="appliance-render"
    style={{ width: size, height: size, backgroundPosition: `${(cell % 3) * 50}% ${Math.floor(cell / 3) * 50}%` }}
    aria-hidden="true"
  />;
}
