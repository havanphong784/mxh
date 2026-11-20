import type { ReactNode } from "react";
import type { User } from "./session";

const glyphs: Record<string, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-2 8-2 8h16s-2-1-2-8M10 20h4" />
    </>
  ),
  mail: <path d="M3 4.5h18v12H9l-6 4v-16Zm4.5 6h9" />,
  bookmark: <path d="M6 4h12v16l-6-4-6 4z" />,
  heart: (
    <path d="M12 20S3 15 3 9a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 6-9 11-9 11Z" />
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="var(--paper)" />
      <circle cx="15" cy="17" r="2" fill="var(--paper)" />
    </>
  ),
  exit: <path d="M10 5H4v14h6m-1-7h11m-4-4 4 4-4 4" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12m0-12L6 18" />,
};
export function Icon({ name, size = 21 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyphs[name]}
    </svg>
  );
}
export function Logo() {
  return (
    <a href="/" className="brand" aria-label="MXH, trang chủ">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
          <rect width="36" height="36" rx="11" fill="currentColor" />
          <path
            d="M9 24V12l9 8 9-8v12M13 12l5 4 5-4"
            stroke="var(--paper)"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        MXH<span className="brand-dot">.</span>
      </span>
    </a>
  );
}
export function Avatar({
  user,
}: {
  user: Pick<User, "displayName" | "avatarUrl">;
}) {
  const words = user.displayName.trim().split(/\s+/).filter(Boolean);
  const initials = words.length
    ? `${words[0][0]}${words.length > 1 ? (words.at(-1)?.[0] ?? "") : ""}`.toLocaleUpperCase(
        "vi",
      )
    : "?";
  return (
    <span className="shell-avatar" aria-hidden="true">
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
    </span>
  );
}
export function Engraving() {
  return (
    <svg
      className="engraving"
      viewBox="0 0 440 275"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="desk-grid"
          width="18"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          <path d="M18 0H0v18" stroke="#7e9b86" strokeOpacity=".23" />
        </pattern>
      </defs>
      <rect x="25" y="18" width="390" height="239" fill="url(#desk-grid)" />
      <circle
        cx="218"
        cy="137"
        r="93"
        stroke="#dce9d8"
        strokeOpacity=".32"
        strokeDasharray="3 6"
      />
      <circle cx="218" cy="137" r="112" stroke="#dce9d8" strokeOpacity=".24" />
      <path
        d="M25 31V18h13m364 0h13v13m0 213v13h-13m-364 0H25v-13"
        stroke="#dce9d8"
        strokeOpacity=".6"
      />
      <path
        d="M63 155c54-34 92-39 154-12s109 50 160 9M70 156c42 37 120 45 159-2s73-54 151-42"
        stroke="#c1d79d"
        strokeOpacity=".55"
      />
      <g transform="translate(106 73) rotate(-9 74 45)">
        <path
          d="M5 13A13 13 0 0 1 18 0h127a13 13 0 0 1 13 13v62a13 13 0 0 1-13 13H57l-29 20v-20H18A13 13 0 0 1 5 75z"
          fill="#29543f"
          stroke="#dce9d8"
          strokeWidth="1.6"
        />
        <circle cx="37" cy="38" r="12" fill="#c9d7a3" />
        <path
          d="M62 32h68M62 46h49m-90 20h111"
          stroke="#dce9d8"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(220 122) rotate(12 59 38)">
        <path
          d="M0 12A12 12 0 0 1 12 0h114a12 12 0 0 1 12 12v51a12 12 0 0 1-12 12h-12v17L91 75H12A12 12 0 0 1 0 63z"
          fill="#dce7b9"
          stroke="#dce9d8"
          strokeWidth="1.6"
        />
        <circle cx="47" cy="37" r="3.5" fill="#315841" />
        <circle cx="69" cy="37" r="3.5" fill="#315841" />
        <circle cx="91" cy="37" r="3.5" fill="#315841" />
      </g>
      <path
        d="M75 69h16m-8-8v16m286 116h14m-7-7v14m-43-146h12m-6-6v12M138 211h12m-6-6v12"
        stroke="#dce9d8"
        strokeLinecap="round"
      />
      <circle cx="66" cy="156" r="4" fill="#dce7b9" />
      <circle cx="378" cy="111" r="4" fill="#dce7b9" />
    </svg>
  );
}
