// @react-pdf/renderer for the browser. The package's browser build exports everything except renderToBuffer
// (it throws an environment error there), which lib/export/pdf.tsx calls. Provide it on top of pdf().toBlob().
import { pdf } from "@react-pdf/renderer/lib/react-pdf.browser.js";

export * from "@react-pdf/renderer/lib/react-pdf.browser.js";

export async function renderToBuffer(element: Parameters<typeof pdf>[0]): Promise<Uint8Array> {
  const blob = await pdf(element).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
