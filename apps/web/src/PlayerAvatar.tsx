import type { CSSProperties } from "react";

const skinColors = ["#f6d0b1", "#e9b58e", "#bf7b54", "#79452f"];
const hairColors = ["#22313a", "#6b412d", "#d39a3a", "#e9eef2"];
const shirtColors = ["#2e9fbd", "#35a77b", "#e36b75", "#e6a947", "#4f6fd6"];

export type AvatarParts = {
  skin: number;
  hair: number;
  shirt: number;
  accessory: number;
};

export const defaultAvatar = "human|1|0|0|0";

export function parseAvatar(value: string): AvatarParts {
  const [kind, skin, hair, shirt, accessory] = value.split("|");
  if (kind !== "human") return { skin: 1, hair: 0, shirt: 0, accessory: 0 };
  return {
    skin: Math.min(3, Math.max(0, Number(skin) || 0)),
    hair: Math.min(3, Math.max(0, Number(hair) || 0)),
    shirt: Math.min(4, Math.max(0, Number(shirt) || 0)),
    accessory: Math.min(3, Math.max(0, Number(accessory) || 0)),
  };
}

export function serializeAvatar(parts: AvatarParts) {
  return `human|${parts.skin}|${parts.hair}|${parts.shirt}|${parts.accessory}`;
}

export function PlayerAvatar({
  value,
  size = 52,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const p = parseAvatar(value);
  const skin = skinColors[p.skin]!;
  const hair = hairColors[p.hair]!;
  const shirt = shirtColors[p.shirt]!;
  return (
    <span
      className={`human-avatar ${className}`}
      style={{ "--avatar-size": `${size}px` } as CSSProperties}
      aria-label="Player avatar"
    >
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <circle cx="50" cy="50" r="48" fill="#dff3f8" />
        <path d="M18 100c2-23 14-34 32-34s30 11 32 34" fill={shirt} />
        <path d="M43 62h14v15H43z" fill={skin} />
        <circle cx="50" cy="43" r="25" fill={skin} />
        <circle cx="27" cy="45" r="5" fill={skin} />
        <circle cx="73" cy="45" r="5" fill={skin} />
        {p.hair === 0 && (
          <path
            d="M25 40c0-20 12-30 27-30 15 0 25 10 25 27-9-1-15-7-19-14-8 8-17 12-33 12z"
            fill={hair}
          />
        )}
        {p.hair === 1 && (
          <path
            d="M25 43c-3-22 9-34 27-34 18 0 29 12 25 34l-8-13-7 8-8-14-9 13-8-9z"
            fill={hair}
          />
        )}
        {p.hair === 2 && (
          <path
            d="M25 41c0-22 11-32 26-32 20 0 28 14 26 35l-8-17c-14 9-26 9-38 3z"
            fill={hair}
          />
        )}
        {p.hair === 3 && (
          <path
            d="M29 32c3-17 15-24 27-21 12 2 19 12 20 26-8-8-13-15-16-24-7 12-16 19-31 19z"
            fill={hair}
          />
        )}
        <circle cx="41" cy="45" r="2.4" fill="#20313a" />
        <circle cx="59" cy="45" r="2.4" fill="#20313a" />
        <path
          d="M43 55c5 4 9 4 14 0"
          fill="none"
          stroke="#8d4e46"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {p.accessory === 1 && (
          <g fill="none" stroke="#24424e" strokeWidth="2.5">
            <circle cx="40" cy="44" r="7" />
            <circle cx="60" cy="44" r="7" />
            <path d="M47 44h6" />
          </g>
        )}
        {p.accessory === 2 && (
          <path
            d="M27 35c13-5 31-5 46 0"
            fill="none"
            stroke="#e85d75"
            strokeWidth="4"
          />
        )}
        {p.accessory === 3 && (
          <path
            d="M67 27l7-5 2 8 8 1-6 6 2 8-8-4-7 5 1-9-6-5z"
            fill="#f2b84b"
            stroke="#bd7d18"
            strokeWidth="1.5"
          />
        )}
      </svg>
    </span>
  );
}

export function AvatarCustomizer({
  value,
  onChange,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  labels: {
    skin: string;
    hair: string;
    shirt: string;
    accessory: string;
    none: string;
  };
}) {
  const p = parseAvatar(value);
  const update = (patch: Partial<AvatarParts>) =>
    onChange(serializeAvatar({ ...p, ...patch }));
  return (
    <div className="avatar-customizer">
      <PlayerAvatar value={value} size={96} />
      <div className="avatar-options">
        <fieldset>
          <legend>{labels.skin}</legend>
          {skinColors.map((color, index) => (
            <button
              key={color}
              type="button"
              className={p.skin === index ? "active" : ""}
              style={{ background: color }}
              onClick={() => update({ skin: index })}
              aria-label={`${labels.skin} ${index + 1}`}
            />
          ))}
        </fieldset>
        <fieldset>
          <legend>{labels.hair}</legend>
          {hairColors.map((color, index) => (
            <button
              key={color}
              type="button"
              className={p.hair === index ? "active" : ""}
              style={{ background: color }}
              onClick={() => update({ hair: index })}
              aria-label={`${labels.hair} ${index + 1}`}
            />
          ))}
        </fieldset>
        <fieldset>
          <legend>{labels.shirt}</legend>
          {shirtColors.map((color, index) => (
            <button
              key={color}
              type="button"
              className={p.shirt === index ? "active" : ""}
              style={{ background: color }}
              onClick={() => update({ shirt: index })}
              aria-label={`${labels.shirt} ${index + 1}`}
            />
          ))}
        </fieldset>
        <fieldset className="accessory-options">
          <legend>{labels.accessory}</legend>
          {[labels.none, "⌁", "—", "★"].map((label, index) => (
            <button
              key={index}
              type="button"
              className={p.accessory === index ? "active" : ""}
              onClick={() => update({ accessory: index })}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
