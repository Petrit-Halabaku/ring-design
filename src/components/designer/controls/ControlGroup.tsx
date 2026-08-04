"use client";

import type { ControlGroupModel } from "@/lib/designer/types";
import ChipRow from "./ChipRow";
import RangeControl from "./RangeControl";
import Segmented from "./Segmented";
import ShapeGrid from "./ShapeGrid";
import SwatchRow from "./SwatchRow";
import Switch from "./Switch";
import TextField from "./TextField";

/** Label + hint + the control the group's `kind` selects. */
export default function ControlGroup({ group }: { group: ControlGroupModel }) {
  const c = group.control;

  return (
    <section className="py-4 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-[15px] leading-snug text-ink-900">
            {group.label}
          </h3>
          {group.hint && (
            <p className="mt-0.5 text-[13px] leading-snug text-ink-600">{group.hint}</p>
          )}
        </div>

        {/* Compact controls sit on the heading row; wide ones drop below it. */}
        {c.kind === "switch" && (
          <Switch value={c.value} onChange={c.onChange} label={group.label} />
        )}
        {c.kind === "range" && (
          <span className="shrink-0 font-serif text-[15px] tabular-nums text-ink-900">
            {c.format(c.value)}
          </span>
        )}
      </div>

      <div className={c.kind === "switch" ? "" : "mt-3"}>
        {c.kind === "swatch" && (
          <SwatchRow
            options={c.options}
            value={c.value}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "shape" && (
          <ShapeGrid
            options={c.options}
            value={c.value}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "chip" && (
          <ChipRow
            options={c.options}
            value={c.value}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "segmented" && (
          <Segmented
            options={c.options}
            value={c.value}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "range" && (
          <RangeControl
            min={c.min}
            max={c.max}
            step={c.step}
            value={c.value}
            presets={c.presets}
            format={c.format}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "text" && (
          <TextField
            value={c.value}
            maxLength={c.maxLength}
            onChange={c.onChange}
            label={group.label}
          />
        )}
      </div>
    </section>
  );
}
