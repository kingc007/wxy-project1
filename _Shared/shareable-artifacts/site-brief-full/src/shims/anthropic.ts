// Stand-in for @anthropic-ai/sdk. This build has no API key and must not be able to call Anthropic; lib/llm/client.ts
// only constructs the client when a key exists (never, here), so this is never instantiated.
export default class Anthropic {
  constructor() {
    throw new Error("The Anthropic SDK is not included in this shareable build.");
  }
}
