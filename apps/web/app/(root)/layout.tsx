import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "บ้านประหยัด | Smart Home Energy", template: "%s | บ้านประหยัด" },
  description: "Monitor and manage smart-plug energy use in Thai or English."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
