"use client";

import React from "react";
import { SensorProvider } from "@/lib/sensors";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SensorProvider>{children}</SensorProvider>;
}

