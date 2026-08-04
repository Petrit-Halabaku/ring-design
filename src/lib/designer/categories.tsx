"use client";

import { BAND_FITS, BAND_STYLES } from "@/lib/settings/bandGeometry";
import { BAND_PAVE_LENGTHS } from "@/lib/settings/bandPave";
import { BASKET_HALOS } from "@/lib/settings/basketHalo";
import { PRONG_TIPS } from "@/lib/settings/prongs";
import { STONE_NAME_TO_SHAPE } from "@/lib/settings/models";
import type { RingConfig } from "./useRingConfig";
import type { Category, TextOption } from "./types";

const ct = (n: number) => `${n.toFixed(2)} ct`;
const mm = (n: number) => `${n.toFixed(1)} mm`;
const us = (n: number) => `${n.toFixed(2)}`;

const asOptions = (xs: readonly string[]): TextOption[] =>
  xs.map((x) => ({ id: x, label: x }));

const ICONS: Record<string, React.ReactNode> = {
  metal: (
    <svg viewBox="0 0 24 24" width={20} height={20} stroke="currentColor" strokeWidth={1.5} fill="none">
      <path d="M12 2l4 6-4 14L8 8z" />
    </svg>
  ),
  stone: (
    <svg viewBox="0 0 24 24" width={20} height={20} stroke="currentColor" strokeWidth={1.5} fill="none">
      <path d="M6 3h12l4 6-10 12L2 9z" />
    </svg>
  ),
  head: (
    <svg viewBox="0 0 24 24" width={20} height={20} stroke="currentColor" strokeWidth={1.5} fill="none">
      <path d="M12 3l3 5H9zM5 10h14l-7 11z" />
    </svg>
  ),
  band: (
    <svg viewBox="0 0 24 24" width={20} height={20} stroke="currentColor" strokeWidth={1.5} fill="none">
      <path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 110 10 5 5 0 010-10z" />
    </svg>
  ),
  engraving: (
    <svg viewBox="0 0 24 24" width={20} height={20} stroke="currentColor" strokeWidth={1.5} fill="none">
      <path d="M4 7h16M4 12h10" />
    </svg>
  ),
};

export function buildCategories(cfg: RingConfig): Category[] {
  const { settings, stones, stone, metal, prongMetal, caratRange, value, set } = cfg;

  return [
    {
      id: "metal",
      label: "Metal",
      icon: ICONS.metal,
      groups: [
        {
          id: "metal-color",
          label: "Head & Band Colour",
          hint: metal.description,
          control: {
            kind: "swatch",
            options: settings.metals.map((m) => ({
              id: m.uiValue,
              label: m.uiValue,
              hex: m.backgroundColor,
            })),
            value: metal.uiValue,
            onChange: (id) =>
              set.setMetalIdx(settings.metals.findIndex((m) => m.uiValue === id)),
          },
        },
      ],
    },
    {
      id: "stone",
      label: "Stone",
      icon: ICONS.stone,
      groups: [
        {
          id: "stone-shape",
          label: "Shape",
          hint: `${ct(value.carat)} ${stone.name}`,
          control: {
            kind: "shape",
            options: stones.map((s) => ({
              id: s.name,
              label: s.name,
              svg: `/shapes/${STONE_NAME_TO_SHAPE[s.name]}.svg`,
            })),
            value: stone.name,
            onChange: (id) => set.setStoneIdx(stones.findIndex((s) => s.name === id)),
          },
        },
        {
          id: "stone-type",
          label: "Diamond Type",
          hint: "Applies to the centre stone and pave, where present",
          control: {
            kind: "segmented",
            options: asOptions(["Natural", "Lab Grown"]),
            value: value.diamondType,
            onChange: (id) => set.setDiamondType(id as typeof value.diamondType),
          },
        },
        {
          id: "stone-carat",
          label: "Carat Weight",
          control: {
            kind: "range",
            min: caratRange.min,
            max: caratRange.max,
            step: 0.05,
            value: value.carat,
            presets: [0.5, 1, 1.5, 2, 3].filter(
              (p) => p >= caratRange.min && p <= caratRange.max,
            ),
            format: ct,
            onChange: set.setCarat,
          },
        },
      ],
    },
    {
      id: "head",
      label: "Head",
      icon: ICONS.head,
      groups: [
        {
          id: "head-basket",
          label: "Basket & Halo",
          hint: BASKET_HALOS.find((b) => b.id === value.basketHalo)?.hint,
          control: {
            kind: "chip",
            options: BASKET_HALOS.map((b) => ({ id: b.id, label: b.label })),
            value: value.basketHalo,
            onChange: (id) => set.setBasketHalo(id as typeof value.basketHalo),
          },
        },
        {
          id: "head-prong-count",
          label: "Prong Count",
          hint: `${cfg.angles.length} prongs`,
          control: {
            kind: "segmented",
            options: cfg.prongCountOptions.map((c) => ({ id: c, label: c })),
            value: cfg.activeProngCount,
            onChange: (id) => set.setProngCount(id as typeof value.prongCount),
          },
        },
        {
          id: "head-prong-tip",
          label: "Prong Tips",
          control: {
            kind: "chip",
            options: PRONG_TIPS.map((t) => ({ id: t.id, label: t.label })),
            value: value.prongTip,
            onChange: (id) => set.setProngTip(id as typeof value.prongTip),
          },
        },
        {
          id: "head-prong-pave",
          label: "Prong Pave",
          hint: value.prongPave ? "Pave prong arms" : "Plain prong arms",
          control: {
            kind: "switch",
            value: value.prongPave,
            onChange: set.setProngPave,
          },
        },
        {
          id: "head-prong-metal",
          label: "Prong Metal",
          hint: value.prongMetalIdx === null ? "Matches the band" : prongMetal.description,
          control: {
            kind: "swatch",
            options: [
              // backgroundColor, not material.color: the latter is the 3D render colour and
              // is #ffffff for 14K White, which would draw this tile as an invisible circle.
              { id: MATCH_BAND, label: "Match Band", hex: metal.backgroundColor },
              ...settings.metals.map((m) => ({
                id: m.uiValue,
                label: m.uiValue,
                hex: m.backgroundColor,
              })),
            ],
            value: value.prongMetalIdx === null ? MATCH_BAND : prongMetal.uiValue,
            onChange: (id) =>
              set.setProngMetalIdx(
                id === MATCH_BAND
                  ? null
                  : settings.metals.findIndex((m) => m.uiValue === id),
              ),
          },
        },
      ],
    },
    {
      id: "band",
      label: "Band",
      icon: ICONS.band,
      groups: [
        {
          id: "band-style",
          label: "Style",
          control: {
            kind: "segmented",
            options: asOptions(BAND_STYLES),
            value: value.bandStyle,
            onChange: (id) => set.setBandStyle(id as typeof value.bandStyle),
          },
        },
        {
          id: "band-cathedral",
          label: "Cathedral",
          hint: "Raises the shoulders to meet the head",
          control: { kind: "switch", value: value.cathedral, onChange: set.setCathedral },
        },
        {
          id: "band-pave",
          label: "Pave",
          hint: value.bandPave ? "Petite French" : "No pave",
          control: { kind: "switch", value: value.bandPave, onChange: set.setBandPave },
        },
        {
          id: "band-pave-length",
          label: "Pave Length",
          control: {
            kind: "chip",
            options: asOptions(BAND_PAVE_LENGTHS),
            value: value.bandPaveLength,
            onChange: (id) => set.setBandPaveLength(id as typeof value.bandPaveLength),
          },
        },
        {
          id: "band-fit",
          label: "Fit",
          control: {
            kind: "segmented",
            options: asOptions(BAND_FITS),
            value: value.bandFit,
            onChange: (id) => set.setBandFit(id as typeof value.bandFit),
          },
        },
        {
          id: "band-width",
          label: "Band Width",
          control: {
            kind: "range",
            min: 1.5,
            max: 4,
            step: 0.1,
            value: value.bandWidth,
            presets: [1.5, 2, 2.5, 3, 4],
            format: mm,
            onChange: set.setBandWidth,
          },
        },
        {
          id: "band-size",
          label: "Ring Size",
          hint: "US / Canada standard sizing",
          control: {
            kind: "range",
            min: 3,
            max: 13,
            step: 0.25,
            value: value.ringSize,
            presets: [4, 6, 8, 10, 12],
            format: us,
            onChange: set.setRingSize,
          },
        },
      ],
    },
    {
      id: "engraving",
      label: "Engraving",
      icon: ICONS.engraving,
      groups: [
        {
          id: "engraving-text",
          label: "Inscription",
          hint: "Up to 14 characters, engraved inside the band",
          control: {
            kind: "text",
            maxLength: 14,
            value: value.engravingText,
            onChange: set.setEngravingText,
          },
        },
        {
          id: "engraving-font",
          label: "Font",
          control: {
            kind: "segmented",
            options: asOptions(["Block", "Cursive"]),
            value: value.engravingFont,
            onChange: (id) => set.setEngravingFont(id as typeof value.engravingFont),
          },
        },
        {
          id: "engraving-surprise",
          label: "Surprise Stones",
          hint: "Hidden stones set inside the shank",
          control: {
            kind: "switch",
            value: value.surpriseStones,
            onChange: set.setSurpriseStones,
          },
        },
      ],
    },
  ];
}

/** Sentinel for the prong-metal swatch that defers to the band. */
export const MATCH_BAND = "__match_band__";
