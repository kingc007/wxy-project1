"use client";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { snapParam, type MassingParams, type ParamSpec } from "@wxy/massing";
import { nowLabel } from "@/lib/studio/actions";
import { paramGroups } from "@/lib/studio/params";
import { useStudio } from "@/lib/store/studio";
import type { OptionSlot } from "@/lib/store/logic";

const ENUM_LABEL: Record<string, string> = {
  none: "None", extrude: "Extrude", tower: "Tower", front: "Front", rear: "Rear", left: "Left", right: "Right",
};

function NumberBox({ spec, value, onCommit }: { spec: ParamSpec; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(n)) onCommit(snapParam(spec.key, n));
    setDraft(null);
  };
  return (
    <Input
      aria-label={`${spec.label}, value`}
      inputMode="decimal"
      className="num h-9 w-16 px-1.5 text-right text-[13px]"
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}

function ParamRow({ slot, spec }: { slot: OptionSlot; spec: ParamSpec }) {
  const setParam = useStudio((s) => s.setParam);
  const set = useStudio((s) => s.set);
  const key = spec.key as keyof MassingParams;
  const value = slot.option.params[key];
  const apply = (v: number | string | boolean) => {
    const err = setParam(slot.index, key, v, spec.label, nowLabel());
    if (err) set({ announcement: err });
  };
  const id = `param-${key}`;
  return (
    <div className="flex flex-col gap-1" title={spec.help}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={spec.kind === "bool" ? id : undefined} id={`${id}-label`} className="text-[13px]">
          {spec.label}
        </label>
        {spec.kind === "bool" && <Switch id={id} aria-labelledby={`${id}-label`} inputRef={(el) => el?.setAttribute("aria-label", spec.label)} checked={value as boolean} onCheckedChange={(c) => apply(c)} />}
        {(spec.kind === "int" || spec.kind === "number") && <NumberBox spec={spec} value={value as number} onCommit={apply} />}
      </div>
      {(spec.kind === "int" || spec.kind === "number") && (
        <Slider
          aria-label={spec.label}
          min={spec.min as number}
          max={spec.max as number}
          step={spec.step as number}
          value={[value as number]}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : v;
            apply(snapParam(key as never, n));
          }}
        />
      )}
      {spec.kind === "enum" && (
        <ToggleGroup
          aria-label={spec.label}
          size="sm"
          spacing={1}
          variant="outline"
          value={[String(value)]}
          onValueChange={(v) => v[0] && apply(v[0])}
        >
          {spec.options?.map((o) => (
            <ToggleGroupItem key={o} value={o}>{ENUM_LABEL[o] ?? o}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}

export function ParamControls({ slot }: { slot: OptionSlot }) {
  const { lead, more } = paramGroups(slot.leadTypology);
  return (
    <div className="flex flex-col gap-3">
      {lead.map((s) => (
        <ParamRow key={s.key} slot={slot} spec={s} />
      ))}
      <details>
        <summary className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring">More parameters ({more.length})</summary>
        <div className="mt-3 flex flex-col gap-3">
          {more.map((s) => (
            <ParamRow key={s.key} slot={slot} spec={s} />
          ))}
        </div>
      </details>
    </div>
  );
}
