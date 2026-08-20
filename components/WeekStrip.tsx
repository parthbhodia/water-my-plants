"use client";

import { Droplets, CloudRain, Trophy, Sprout } from "lucide-react";
import PlantIcon from "./PlantIcon";
import { RevealList, RevealItem } from "./motion/Reveal";

const DAYS: Array<{
  d: string;
  stage: number;
  wilted?: boolean;
  cap: string;
  icon?: "water" | "miss" | "trophy" | "seed";
}> = [
  { d: "Mon", stage: 0, cap: "Plant", icon: "seed" },
  { d: "Tue", stage: 1, cap: "Water", icon: "water" },
  { d: "Wed", stage: 2, cap: "Water", icon: "water" },
  { d: "Thu", stage: 2, wilted: true, cap: "Missed — she wilts, not dies", icon: "miss" },
  { d: "Fri", stage: 3, cap: "Rescued", icon: "water" },
  { d: "Sat", stage: 5, cap: "Almost…", icon: "water" },
  { d: "Sun", stage: 6, cap: "Bloom · league day", icon: "trophy" },
];

const ICONS = {
  seed: Sprout,
  water: Droplets,
  miss: CloudRain,
  trophy: Trophy,
};

/** One week of the loop, told entirely in pictures. */
export default function WeekStrip() {
  return (
    <RevealList className="week-strip" stagger={0.08}>
      {DAYS.map((day) => {
        const Icon = day.icon ? ICONS[day.icon] : null;
        return (
          <RevealItem className={`week-day${day.wilted ? " missed" : ""}`} key={day.d}>
            <span className="wd-name">{day.d}</span>
            <span className="wd-art">
              <PlantIcon species="sunflower" stage={day.stage} wilted={day.wilted} size={56} />
            </span>
            <span className="wd-cap">
              {Icon && <Icon size={13} strokeWidth={2.6} aria-hidden />}
              {day.cap}
            </span>
          </RevealItem>
        );
      })}
    </RevealList>
  );
}
