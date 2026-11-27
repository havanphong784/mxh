import type { ReactNode } from "react";

// One 24px icon family: matching outline/solid pairs share the same silhouette.
const outlines: Record<string, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2.5 5.5L8 16l2.5-5.5z" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 6-2 6-2 9h16c0-3-2-3-2-9M10 21h4" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  message: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5Z" />,
  bookmark: <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" />,
  heart: <path d="m12 21-8.1-8A5.5 5.5 0 0 1 12 5.6 5.5 5.5 0 0 1 20.1 13z" />,
  person: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  settings: (
    <>
      <path d="m9 3-.5 2a8 8 0 0 0-2 1.2l-2-.6-2 3.5 1.5 1.5a8 8 0 0 0 0 2.8l-1.5 1.5 2 3.5 2-.6a8 8 0 0 0 2 1.2l.5 2h6l.5-2a8 8 0 0 0 2-1.2l2 .6 2-3.5-1.5-1.5a8 8 0 0 0 0-2.8l1.5-1.5-2-3.5-2 .6a8 8 0 0 0-2-1.2L15 3z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  exit: <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5m0-8h11m-4-4 4 4-4 4" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  repost: <path d="m17 3 4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3" />,
  reply: (
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.6-4.3A8.5 8.5 0 1 1 21 11.5Z" />
  ),
  quote: (
    <path
      fill="currentColor"
      stroke="none"
      d="M4 6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a7 7 0 0 1-6 7v-2.5A4.5 4.5 0 0 0 7.5 13H5a1 1 0 0 1-1-1V6Zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a7 7 0 0 1-6 7v-2.5a4.5 4.5 0 0 0 3.5-3.5H15a1 1 0 0 1-1-1V6Z"
    />
  ),
  pen: <path d="m14.5 5.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11z" />,
  write: <path d="m14.5 5.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11z" />,
  trash: <path d="M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  clip: <path d="m9 13 6-6a3 3 0 0 1 4.2 4.2l-8.5 8.5a5 5 0 0 1-7.1-7.1L12 4.2" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  post: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6m-6 4h6m-6 4h3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="15.5" cy="8.5" r="1.5" />
      <path d="m3 16 5-5 6 6 3-3 4 4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  send: (
    <>
      <path d="m21 3-7 18-4-7-7-4zM21 3 10 14" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z" />,
};

const selected: Record<string, ReactNode> = {
  home: (
    <path
      fill="currentColor"
      stroke="none"
      d="m12 2 10 8v9a3 3 0 0 1-3 3h-5v-8h-4v8H5a3 3 0 0 1-3-3v-9z"
    />
  ),
  compass: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM17 7l-6.8 3.2L7 17l6.8-3.2z"
    />
  ),
  bell: (
    <>
      <path
        fill="currentColor"
        stroke="none"
        d="M12 1a7 7 0 0 0-7 7c0 3.8-.7 5.4-1.3 6.4A5 5 0 0 0 3 17v1h18v-1a5 5 0 0 0-.7-2.6C19.7 13.4 19 11.8 19 8a7 7 0 0 0-7-7Z"
      />
      <path d="M10 21h4" />
    </>
  ),
  mail: (
    <path
      fill="currentColor"
      stroke="none"
      d="M6 4a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4ZM4 7l8 5.5L20 7v2l-8 5.5L4 9Z"
      fillRule="evenodd"
    />
  ),
  message: (
    <path
      fill="currentColor"
      stroke="none"
      d="M22 11.5a9.5 9.5 0 0 1-9.5 9.5H2.6l1.8-4.9A9.5 9.5 0 1 1 22 11.5Z"
    />
  ),
  bookmark: <path fill="currentColor" d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" />,
  heart: (
    <path
      fill="currentColor"
      stroke="none"
      d="m12 21-8.1-8A5.5 5.5 0 0 1 12 5.6 5.5 5.5 0 0 1 20.1 13z"
    />
  ),
  person: (
    <>
      <circle cx="12" cy="7.5" r="4.5" fill="currentColor" stroke="none" />
      <path fill="currentColor" stroke="none" d="M3 22v-3a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v3z" />
    </>
  ),
  settings: (
    <>
      <path
        fill="currentColor"
        stroke="none"
        fillRule="evenodd"
        d="m9 2-.6 2.3-2 1.2L4 4.8.8 10l1.8 1.8v.4L.8 14 4 19.2l2.4-.7 2 1.2L9 22h6l.6-2.3 2-1.2 2.4.7 3.2-5.2-1.8-1.8v-.4l1.8-1.8L20 4.8l-2.4.7-2-1.2L15 2Zm3 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
      />
    </>
  ),
  repost: (
    <>
      <path d="m17 3 4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

export function Icon({
  name,
  size = 21,
  active = false,
  className,
}: {
  name: string;
  size?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      data-variant={active ? "selected" : "outline"}
    >
      {active ? (selected[name] ?? outlines[name]) : outlines[name]}
    </svg>
  );
}
