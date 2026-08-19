// Hand-drawn-with-code SVG art for each growth stage (used in journal + landing).
export default function StageArt({ stage, size = 92 }: { stage: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {/* pond puddle */}
      <ellipse cx="50" cy="78" rx="40" ry="14" fill="#7fc8e8" />
      <ellipse cx="50" cy="76" rx="34" ry="11" fill="#a5dcf2" opacity="0.7" />
      {stage === 0 && (
        <g>
          <ellipse cx="50" cy="76" rx="7" ry="5.5" fill="#8b693e" />
          <ellipse cx="47.6" cy="74.4" rx="2.2" ry="1.6" fill="#c9a86a" />
        </g>
      )}
      {stage === 1 && (
        <g>
          <path d="M50 76 C50 66 50 60 50 54" stroke="#3e8e52" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <ellipse cx="44" cy="54" rx="7" ry="3.6" fill="#58b368" transform="rotate(-28 44 54)" />
          <ellipse cx="56" cy="52" rx="7" ry="3.6" fill="#6cc17b" transform="rotate(24 56 52)" />
        </g>
      )}
      {stage === 2 && (
        <g>
          <ellipse cx="50" cy="74" rx="13" ry="6" fill="#58b368" />
          <path d="M50 74 L40 74 A11 5.5 0 0 1 50 68 Z" fill="#3e8e52" />
          <path d="M56 72 C58 64 58 60 57 56" stroke="#3e8e52" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <ellipse cx="59" cy="55" rx="4.5" ry="2.6" fill="#6cc17b" transform="rotate(30 59 55)" />
        </g>
      )}
      {stage === 3 && (
        <g>
          <ellipse cx="48" cy="74" rx="19" ry="8" fill="#58b368" />
          <path d="M48 74 L33 74 A16 7 0 0 1 48 66 Z" fill="#3e8e52" />
          <ellipse cx="72" cy="79" rx="9" ry="4" fill="#6cc17b" />
          <ellipse cx="46" cy="72.4" rx="12" ry="4.4" fill="#6cc17b" opacity="0.5" />
        </g>
      )}
      {stage === 4 && (
        <g>
          <ellipse cx="46" cy="76" rx="18" ry="7.5" fill="#58b368" />
          <path d="M46 76 L32 76 A15 6.5 0 0 1 46 69 Z" fill="#3e8e52" />
          <path d="M58 74 C60 62 60 56 59 48" stroke="#3e8e52" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="59" cy="43" rx="6.5" ry="9" fill="#6cc17b" />
          <ellipse cx="59" cy="41" rx="3.5" ry="6" fill="#8ed69b" />
        </g>
      )}
      {stage === 5 && (
        <g>
          <ellipse cx="45" cy="76" rx="19" ry="8" fill="#58b368" />
          <path d="M45 76 L30 76 A16 7 0 0 1 45 68 Z" fill="#3e8e52" />
          <path d="M58 74 C61 60 61 52 60 44" stroke="#3e8e52" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="60" cy="38" rx="7.5" ry="11" fill="#f7a8c4" />
          <ellipse cx="55.5" cy="41" rx="4" ry="8" fill="#6cc17b" transform="rotate(-16 55.5 41)" />
          <ellipse cx="64.5" cy="41" rx="4" ry="8" fill="#6cc17b" transform="rotate(16 64.5 41)" />
          <ellipse cx="60" cy="36" rx="3.4" ry="7" fill="#ee7fa9" />
        </g>
      )}
      {stage === 6 && (
        <g>
          <ellipse cx="50" cy="78" rx="24" ry="9" fill="#58b368" />
          <path d="M50 78 L31 78 A20 8 0 0 1 50 69 Z" fill="#3e8e52" />
          <g transform="translate(50 46)">
            <ellipse rx="8" ry="18" fill="#f7a8c4" transform="rotate(-64)" />
            <ellipse rx="8" ry="18" fill="#f7a8c4" transform="rotate(64)" />
            <ellipse rx="8" ry="18" fill="#f492b6" transform="rotate(-32)" opacity="0.95" />
            <ellipse rx="8" ry="18" fill="#f492b6" transform="rotate(32)" opacity="0.95" />
            <ellipse rx="7.5" ry="18" fill="#ee7fa9" />
            <circle cy="10" r="6" fill="#ffd76e" />
            <circle cy="10" r="3" fill="#ffb63e" />
          </g>
        </g>
      )}
      {/* sparkle */}
      {stage >= 5 && <path d="M24 30 l2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4 Z" fill="#ffd76e" />}
    </svg>
  );
}
