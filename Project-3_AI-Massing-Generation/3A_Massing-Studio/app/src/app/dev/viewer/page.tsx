import type { Metadata } from "next";
import { ViewerDemo } from "./ViewerDemo";

// DEV ONLY: not linked from the main page. Hardcoded TEST prisms (not engine output).
export const metadata: Metadata = {
  title: "Viewer demo (dev only)",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ViewerDemo />;
}
