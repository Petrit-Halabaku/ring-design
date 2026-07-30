/* eslint-disable @next/next/no-img-element -- plain <img> matches the original markup that the copied CSS sizes directly */
"use client";

import { useState } from "react";
import {
  CARATS,
  DIAMOND_SHAPES,
  LOCATION_GROUPS,
  METALS,
  RING_STYLES,
  STEP_COPY,
  TIMELINES,
  TOTAL_STEPS,
  type Metal,
  type StoneType,
} from "./data";

type HistoryItem = { label: string; img?: string };

/** What the walkthrough hands to the 3D designer. */
export type WizardResult = { shapeId?: string; carat?: number };

type Props = {
  onComplete: (result: WizardResult) => void;
};

export default function RingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [metal, setMetal] = useState<Metal>("yellow");
  const [stoneType, setStoneType] = useState<StoneType>("natural");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expandedState, setExpandedState] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [picked, setPicked] = useState<WizardResult>({});

  function finish(result: WizardResult) {
    setLeaving(true);
    window.setTimeout(() => onComplete(result), 300);
  }

  /** Records the choice, then either steps forward or hands the result to the designer. */
  function advance(item: HistoryItem, patch: WizardResult = {}) {
    const next = { ...picked, ...patch };
    setPicked(next);
    setHistory((h) => [...h.slice(0, step), item]);

    if (step === TOTAL_STEPS - 1) finish(next);
    else setStep((s) => s + 1);
  }

  function back() {
    if (step === 0) return;
    setHistory((h) => h.slice(0, step - 1));
    setStep((s) => s - 1);
  }

  const copy = STEP_COPY[step];

  return (
    <div className={`jos-walkthrough jos-fade-in${leaving ? " fade-out" : ""}`}>
      <div className="jos-nav">
        <button className="jos-back" onClick={back} disabled={step === 0}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {step === 0 ? <span className="jos-back-text">Back</span> : null}
        </button>

        <div className="jos-history">
          {history.map((h, i) => (
            <div className="jos-history-item" key={`${h.label}-${i}`}>
              {h.img ? <img src={h.img} alt={h.label} /> : null}
              {h.label}
            </div>
          ))}
        </div>

        <button type="button" className="jos-skip" onClick={() => finish(picked)}>
          Skip
        </button>
      </div>

      <div className="jos-content">
        <div className="jos-content-content">
          <div className="jos-step-content current">
            <div className="jos-step-counter" style={{ textAlign: "center" }}>
              Step {step + 1} of {TOTAL_STEPS}
            </div>

            <div className="jos-step-header">
              <h2 className="jos-step-title">{copy.title}</h2>
              <p className="jos-step-subtitle">{copy.subtitle}</p>
            </div>

            {step === 0 && (
              <>
                <div className="jos-metal-buttons">
                  {METALS.map((m) => (
                    <button
                      key={m.id}
                      aria-label={`${m.id} gold`}
                      className={`jos-metal-btn${metal === m.id ? " active" : ""}`}
                      style={{ background: m.background }}
                      onClick={() => setMetal(m.id)}
                    />
                  ))}
                </div>

                <div className="jos-options" data-grid="3x3">
                  {RING_STYLES.map((s) => (
                    <button
                      key={s.id}
                      className="jos-option"
                      data-id={s.id}
                      onClick={() =>
                        advance({
                          label: s.title,
                          img: `/rings/${s.id}_${metal}.webp`,
                        })
                      }
                    >
                      <img
                        className="jos-step-1-img"
                        src={`/rings/${s.id}_${metal}.webp`}
                        title={s.title}
                        alt={s.title}
                      />
                      <div className="jos-option-title">{s.title}</div>
                      <p className="jos-option-desc">{s.desc}</p>
                    </button>
                  ))}
                  <button
                    className="jos-option center-vert"
                    data-id="custom"
                    onClick={() => advance({ label: "Start from scratch" })}
                  >
                    <div className="jos-option-title-solo">Start from scratch</div>
                  </button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="jos-stone-type-toggle">
                  {(
                    [
                      ["natural", "Natural"],
                      ["lab", "Lab Grown"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      className={`jos-stone-type-btn${stoneType === id ? " active" : ""}`}
                      data-stone-type={id}
                      onClick={() => setStoneType(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="jos-options" data-grid="3x3" data-stone-type={stoneType}>
                  {DIAMOND_SHAPES.map((s) => (
                    <button
                      key={s.id}
                      className="jos-option"
                      data-id={s.id}
                      onClick={() =>
                        advance(
                          { label: s.title, img: `/shapes/${s.id}.svg` },
                          { shapeId: s.id },
                        )
                      }
                    >
                      <img
                        className="jos-shape-img"
                        src={`/shapes/${s.id}.svg`}
                        title={s.title}
                        alt={s.title}
                      />
                      <div className="jos-option-title">{s.title}</div>
                      <p className="jos-option-desc">{s.desc}</p>
                    </button>
                  ))}
                  <button
                    className="jos-option center-vert"
                    data-id="unknown"
                    onClick={() => advance({ label: "Decide later" })}
                  >
                    <div className="jos-option-title-solo">Decide later</div>
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="jos-options" data-grid="2x2">
                {CARATS.map((c) => (
                  <button
                    key={c.id}
                    className="jos-option"
                    data-id={c.id}
                    onClick={() =>
                      advance(
                        { label: c.title },
                        { carat: parseFloat(c.id.replace("carat-", "")) },
                      )
                    }
                  >
                    <div className="jos-option-title-solo">{c.title}</div>
                  </button>
                ))}
                <button
                  className="jos-option"
                  data-id="carat-unknown"
                  onClick={() => advance({ label: "Decide later" })}
                >
                  <div className="jos-option-title-solo">Decide later</div>
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="jos-options" data-grid="1x1">
                {TIMELINES.map((t) => (
                  <button
                    key={t.id}
                    className="jos-option"
                    data-id={t.id}
                    onClick={() => advance({ label: t.title })}
                  >
                    <div className="jos-option-title-solo">{t.title}</div>
                  </button>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="jos-location-picker">
                {LOCATION_GROUPS.map((g) => (
                  <div
                    key={g.state}
                    className={`jos-state-group${expandedState === g.state ? " expanded" : ""}`}
                  >
                    <button
                      className="jos-state-header"
                      onClick={() =>
                        setExpandedState((s) => (s === g.state ? null : g.state))
                      }
                    >
                      <span className="jos-state-name">{g.state}</span>
                      <span className="jos-state-meta">
                        <span className="jos-state-count">
                          {g.locations.length} store
                          {g.locations.length === 1 ? "" : "s"}
                        </span>
                        <svg
                          className="jos-state-chevron"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </button>

                    <div className="jos-state-locations">
                      <div className="jos-state-locations-inner">
                        {g.locations.map((loc) => (
                          <button
                            key={loc.id}
                            className="jos-loc-card"
                            onClick={() => advance({ label: loc.name })}
                          >
                            <span className="jos-loc-icon">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                            </span>
                            <span className="jos-loc-details">
                              <span className="jos-loc-name">{loc.name}</span>
                              <span className="jos-loc-address">{loc.address}</span>
                              <span className="jos-loc-hours">{loc.hours}</span>
                            </span>
                            <svg
                              className="jos-loc-arrow"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  className="jos-loc-decide-later"
                  onClick={() => advance({ label: "Decide later" })}
                >
                  Decide later
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
