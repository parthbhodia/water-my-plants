"use client";

import { Sprout, Droplets, Trophy } from "lucide-react";
import { RevealList, RevealItem } from "./motion/Reveal";

const ICONS = { sprout: Sprout, droplets: Droplets, trophy: Trophy } as const;

export default function StepRow({
  steps,
}: {
  steps: ReadonlyArray<{ icon: keyof typeof ICONS; title: string; body: string }>;
}) {
  return (
    <RevealList className="step-row" stagger={0.1}>
      {steps.map((s, i) => {
        const Icon = ICONS[s.icon];
        return (
          <RevealItem className="step-card" key={s.title}>
            <span className="step-icon"><Icon size={26} strokeWidth={2.2} aria-hidden /></span>
            <span className="step-n">Step {i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </RevealItem>
        );
      })}
    </RevealList>
  );
}
