// Minimal next/dynamic: React.lazy + Suspense, with the `loading` component as the fallback (client only).
import { createElement, lazy, Suspense, type ComponentType } from "react";

interface Options {
  ssr?: boolean;
  loading?: ComponentType<unknown>;
}

export default function dynamic<P extends object>(
  loader: () => Promise<ComponentType<P> | { default: ComponentType<P> }>,
  options: Options = {},
): ComponentType<P> {
  const Lazy = lazy(async () => {
    const m = await loader();
    return "default" in (m as object) ? (m as { default: ComponentType<P> }) : { default: m as ComponentType<P> };
  });
  const Fallback = options.loading;
  function Dynamic(props: P) {
    return createElement(
      Suspense,
      { fallback: Fallback ? createElement(Fallback as ComponentType) : null },
      createElement(Lazy as ComponentType<object>, props as object),
    );
  }
  return Dynamic as ComponentType<P>;
}
