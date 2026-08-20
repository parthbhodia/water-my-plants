"use client";

import { Reveal } from "./motion/Reveal";
import GuidePortrait from "./GuidePortrait";
import { GUIDE_NAME } from "@/game/guide";

/** The closing promise, signed in character. */
export default function GrannyPledge() {
  return (
    <Reveal className="pledge-wrap">
      <div className="pledge-note">
        <div className="pledge-head">
          <GuidePortrait mood="happy" size={64} />
          <p className="pledge-title">A note from {GUIDE_NAME}</p>
        </div>
        <ul>
          <li>No adverts. No purchases. No energy timers.</li>
          <li>Miss a day and your plant wilts — it doesn't die on you.</li>
          <li>A turn takes a minute. The garden does the rest.</li>
        </ul>
        <p className="pledge-sign">Your garden is yours. — {GUIDE_NAME}</p>
        <a className="btn" href="#play">Start your garden</a>
      </div>
    </Reveal>
  );
}
