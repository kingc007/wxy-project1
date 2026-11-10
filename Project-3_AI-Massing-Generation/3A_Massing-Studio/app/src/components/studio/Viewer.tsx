"use client";
// Client boundary for the 3D viewer: three/r3f are loaded lazily and never server-rendered.
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const Loading = () => <Skeleton className="size-full rounded-none" aria-hidden />;

export const MassingScene = dynamic(() => import("@/components/viewer/MassingScene").then((m) => m.MassingScene), {
  ssr: false,
  loading: Loading,
});
export const OptionsGrid = dynamic(() => import("@/components/viewer/OptionsGrid").then((m) => m.OptionsGrid), {
  ssr: false,
  loading: Loading,
});
