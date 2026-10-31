/**
 * Inline SVG icon helper.
 *
 * The shell components (Nav, Footer, ThemeToggle) never imported
 * `lucide-react` in the Astro source -- their icons were already raw
 * inline `<svg>` markup. This module gives that markup a single audited
 * home so later groups (FeatureGrid, ComparisonTable, InteractiveDemo, etc.)
 * have a runtime-neutral replacement ready when they drop `lucide-react`.
 *
 * All icons are decorative by default (`aria-hidden="true"`) because every
 * call site in the shell already pairs the icon with visible text or an
 * `aria-label` on the interactive parent (button/link). Pass `title` to
 * expose an accessible name instead when an icon is ever used alone.
 */
import type { FC } from "hono/jsx";

export interface IconProps {
  className?: string;
  title?: string;
}

function iconA11yProps(title?: string) {
  return title ? { role: "img", "aria-label": title } : { "aria-hidden": "true" };
}

export const GitHubIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="currentColor" viewBox="0 0 24 24" {...iconA11yProps(title)}>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

export const NpmIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="currentColor" viewBox="0 0 24 24" {...iconA11yProps(title)}>
    <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h2.665v5.331zm12 0h-1.334v-4h-1.332v4h-1.336v-4h-1.332v4H12V8.667h10.666v5.331z" />
  </svg>
);

export const MenuIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...iconA11yProps(title)}>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const SunIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="currentColor" viewBox="0 0 20 20" {...iconA11yProps(title)}>
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
    />
  </svg>
);

export const MoonIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="currentColor" viewBox="0 0 20 20" {...iconA11yProps(title)}>
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
  </svg>
);

/** Stroke defaults matching lucide-react's rendered output (v1.31.0). */
const strokeIconProps = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
};

export const RocketIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" />
    <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" />
  </svg>
);

export const ArrowRightIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const GitBranchIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M15 6a9 9 0 0 0-9 9V3" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
  </svg>
);

/**
 * ComparisonTable/FeatureGrid icons (Phase 2, group 3 -- "features"),
 * matching lucide-react's rendered output (v1.31.0). `CheckCircle2Icon`,
 * `AlertTriangleIcon`, `XCircleIcon`, and `FileCode2Icon` are lucide-react
 * aliases (`check-circle-2` -> `circle-check`, `alert-triangle` ->
 * `triangle-alert`, `x-circle` -> `circle-x`, `file-code-2` ->
 * `file-code-corner`); the path data below is the aliased icon's, matching
 * what lucide-react actually rendered.
 */
export const CheckCircle2Icon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const AlertTriangleIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const XCircleIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

export const SearchIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </svg>
);

export const ShieldIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

export const FileTextIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);

export const BadgeCheckIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const CoinsIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />
    <path d="M15 6h1v4" />
    <path d="m6.134 14.768.866-.5 2 3.464" />
    <circle cx="16" cy="8" r="6" />
  </svg>
);

export const FileCode2Icon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M4 12.15V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-3.35" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    <path d="m5 16-3 3 3 3" />
    <path d="m9 22 3-3-3-3" />
  </svg>
);

export const HeartIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
  </svg>
);

export const WrenchIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
  </svg>
);

export const GlobeIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

export const FolderKanbanIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    <path d="M8 10v4" />
    <path d="M12 10v2" />
    <path d="M16 10v6" />
  </svg>
);

/**
 * Install-page icons (Phase 2, group 4 -- "install"), matching
 * lucide-react's rendered output (v1.31.0). `CheckIcon` is the plain
 * `check` glyph (distinct from `CheckCircle2Icon` above); `XIcon` is the
 * plain `x` glyph (distinct from `XCircleIcon`).
 */
export const CheckIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const XIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export const ChevronDownIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const CompassIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <circle cx="12" cy="12" r="10" />
    <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
  </svg>
);

export const LightbulbIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

export const LockIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const PencilIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </svg>
);

export const ZapIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z" />
  </svg>
);

export const FolderOpenIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
  </svg>
);

export const LayersIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
    <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
    <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
  </svg>
);

/**
 * How-It-Works page icon (Phase 2, group 5 -- "how-it-works"), matching
 * lucide-react's rendered `target` output (v1.31.0).
 */
export const TargetIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

/**
 * Copy-to-clipboard icon used by every `copy-btn`/`copy-code-btn` in
 * `Terminal.tsx`. Not a lucide-react icon in the Astro source (it was
 * already raw inline `<svg>` markup there); centralized here purely to
 * deduplicate the identical markup repeated 8+ times.
 */
export const CopyIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...iconA11yProps(title)}>
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

/**
 * Demo-page tab icons (Phase 2, group 7 -- "demo"), matching lucide-react's
 * rendered output (v1.31.0). `PenSquareIcon` is the `PenSquare` alias of the
 * `square-pen` icon (identical path data); `FilePenLineIcon`/`LibraryBigIcon`/
 * `TagsIcon` need no alias.
 */
export const PenSquareIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
  </svg>
);

export const FilePenLineIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z" />
    <path d="M14.487 7.858A1 1 0 0 1 14 7V2" />
    <path d="M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516" />
    <path d="M8 18h1" />
  </svg>
);

export const LibraryBigIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <rect width="8" height="18" x="3" y="3" rx="1" />
    <path d="M7 3v18" />
    <path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" />
  </svg>
);

export const TagsIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} viewBox="0 0 24 24" {...strokeIconProps} {...iconA11yProps(title)}>
    <path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z" />
    <path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193" />
    <circle cx="10.5" cy="6.5" r=".5" fill="currentColor" />
  </svg>
);

/**
 * Demo-page detail-list and "Technical Details" heading icons. Neither was
 * a `lucide-react` import in the Astro source -- both were already raw
 * inline `<svg>` markup in `InteractiveDemo.tsx` -- so they are centralized
 * here like `CopyIcon`, not matched against a lucide-react package name.
 */
export const InfoIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...iconA11yProps(title)}>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const CheckCircleFilledIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="currentColor" viewBox="0 0 20 20" {...iconA11yProps(title)}>
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
    />
  </svg>
);

/**
 * Demo-page CTA icon ("Get Started Now" link, `demo-cta-link`). Not a
 * `lucide-react` import in the Astro source -- already raw inline `<svg>`
 * markup -- centralized here like `CopyIcon`.
 */
export const DownloadIcon: FC<IconProps> = ({ className, title }) => (
  <svg class={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" {...iconA11yProps(title)}>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);
