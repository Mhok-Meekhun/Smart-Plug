"use client";

import { useLocale } from "next-intl";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { time: "06", value: 0.18 }, { time: "09", value: 0.38 }, { time: "12", value: 0.31 },
  { time: "15", value: 0.72 }, { time: "18", value: 0.92 }, { time: "21", value: 0.54 }
];

export function EnergyChart() {
  const locale = useLocale();
  return (
    <div className="h-64 w-full" role="img" aria-label={locale === "th" ? "กราฟการใช้พลังงานรายวัน" : "Daily energy consumption chart"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
          <defs><linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2baa4d" stopOpacity={0.3}/><stop offset="1" stopColor="#2baa4d" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid stroke="#e9eee9" strokeDasharray="4 5" vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#7a857c", fontSize: 12 }} unit=":00" />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7a857c", fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kWh`, locale === "th" ? "พลังงาน" : "Energy"]} contentStyle={{ borderRadius: 14, border: "1px solid #dfe8e0", boxShadow: "0 8px 24px rgba(20,50,28,.08)" }} />
          <Area type="monotone" dataKey="value" stroke="#249b45" strokeWidth={3} fill="url(#energyFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
