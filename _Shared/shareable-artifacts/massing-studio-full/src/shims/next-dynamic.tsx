// Browser-only stand-in for next/dynamic: React.lazy + Suspense with the optional `loading` component.
import { createElement, lazy, Suspense, type ComponentType } from "react";

interface Opts {
  ssr?: boolean;
  loading?: ComponentType;
}
export default function dynamic<P extends object>(loader: () => Promise<ComponentType<P>>, opts: Opts = {}): ComponentType<P> {
  const L = lazy(async () => ({ default: (await loader()) as ComponentType<any> }));
  const Fallback = opts.loading;
  const Wrapped = (props: P) => createElement(Suspense, { fallback: Fallback ? createElement(Fallback) : null }, createElement(L, props as any));
  return Wrapped;
}
