"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function EnergyChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const locale = useLocale();
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimate(!preference.matches);
    const update = () => setAnimate(!preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label={
        locale === "th"
          ? "กราฟการใช้พลังงานรายวัน"
          : "Daily energy consumption chart"
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 4, left: -24, bottom: 0 }}
          barCategoryGap="35%"
        >
          <defs>
            <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#40b65d" />
              <stop offset="1" stopColor="#258f45" />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#e8efe9"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#7a857c", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#7a857c", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => [
              `${Number(value).toFixed(2)} kWh`,
              locale === "th" ? "พลังงาน" : "Energy",
            ]}
            cursor={{ fill: "#eff8f0", radius: 10 }}
            contentStyle={{
              borderRadius: 16,
              border: "1px solid #dfe8e0",
              boxShadow: "0 14px 30px rgba(20,50,28,.12)",
            }}
          />
          <Bar
            dataKey="value"
            fill="url(#energyFill)"
            radius={[6, 6, 2, 2]}
            isAnimationActive={animate}
            animationDuration={850}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
