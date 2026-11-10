import { createRoot } from "react-dom/client";
import "./styles.css";
import { installFetchRouter } from "./fetch-router";
import { getDownloads } from "./shims/download";
import { StudioApp } from "@/components/studio/StudioApp";

installFetchRouter();
void getDownloads(); // resolve the downloads capability early; never blocks render
createRoot(document.getElementById("root")!).render(<StudioApp />);

// rhino3dm takes 10+ s to start inside the artifact sandbox, with no feedback during the first .3dm export.
// Warm it up once the page is idle so the export responds at once; a failure here just leaves the lazy path.
const idle = (cb: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(cb, { timeout: 15_000 }) : setTimeout(cb, 8_000));
setTimeout(() => idle(() => void import("@/lib/export/export3dm").then((m) => m.getRhino()).catch(() => {})), 6_000);
