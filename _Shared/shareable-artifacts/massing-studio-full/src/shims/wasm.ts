// base64(gzip(wasm)) -> bytes, using the platform DecompressionStream (no network, no extra library).
export async function inflateBase64Gzip(b64: string): Promise<Uint8Array> {
  const bin = atob(b64);
  const gz = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
  const stream = new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
