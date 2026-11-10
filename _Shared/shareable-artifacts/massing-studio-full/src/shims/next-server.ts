// next/server stand-in: the status route only uses connection() to opt out of prerendering.
export async function connection(): Promise<void> {}
