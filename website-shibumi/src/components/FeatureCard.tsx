/**
 * Bento-grid feature card. Ported from FeatureCard.astro.
 *
 * `lucide-react` icons are replaced with the audited inline SVG helpers in
 * `icons.tsx`. Each icon here sits next to a visible `<h3>` title, so the
 * default `aria-hidden="true"` (no `title` prop) is correct -- same
 * reasoning as the shell icons.
 *
 * The large card's static code sample is highlighted server-side with
 * Shiki (`highlight.ts`) instead of `CodeBlock.tsx`'s
 * `react-syntax-highlighter`. `FeatureCard` is async so the pre-rendered
 * markup can be awaited directly; Hono's JSX renderer supports async
 * components (`c.html()` awaits the whole tree).
 *
 * Raw-HTML audit: `highlightCode()`'s output is passed through `raw()`
 * below. It is safe because the only inputs are this module's own fixed
 * literal `codeExample` strings (never user/request data) -- same audited
 * pattern as `Layout`'s JSON-LD script.
 */
import { raw } from "hono/html";
import {
  BadgeCheckIcon,
  CoinsIcon,
  FileCode2Icon,
  FileTextIcon,
  FolderKanbanIcon,
  GlobeIcon,
  HeartIcon,
  SearchIcon,
  ShieldIcon,
  WrenchIcon,
  type IconProps,
} from "./icons";
import { highlightCode } from "../lib/highlight";
import type { FC } from "hono/jsx";

export type FeatureCardSize = "small" | "medium" | "large";

export interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  size?: FeatureCardSize;
  accent?: boolean;
  codeExample?: string;
}

const ICON_MAP: Record<string, FC<IconProps>> = {
  search: SearchIcon,
  shield: ShieldIcon,
  file: FileTextIcon,
  node: BadgeCheckIcon,
  tokens: CoinsIcon,
  typescript: FileCode2Icon,
  heart: HeartIcon,
  toolkit: WrenchIcon,
  platform: GlobeIcon,
  vault: FolderKanbanIcon,
};

export async function FeatureCard({ title, description, icon, size = "medium", accent = false, codeExample }: FeatureCardProps) {
  const Icon = ICON_MAP[icon];
  const highlighted = codeExample && size === "large" ? await highlightCode(codeExample, "json") : null;

  return (
    <div class={`feature-card feature-card--${size}${accent ? " feature-card--accent" : ""} fade-in-on-scroll`}>
      <div class="feature-card-glow" />
      {accent ? <div class="feature-card-accent-glow" /> : null}

      <div class="feature-card-body">
        <div class="feature-card-heading">
          <div class="feature-card-icon">{Icon ? <Icon className="icon" /> : <span class="feature-card-icon-fallback">{icon}</span>}</div>
          <div class="feature-card-heading-text">
            <h3 class="feature-card-title">{title}</h3>
            <p class="feature-card-description">{description}</p>
          </div>
        </div>

        {highlighted ? (
          <div class="feature-card-code">
            <div class="feature-card-code-inner">{raw(highlighted)}</div>
          </div>
        ) : null}
      </div>

      <div class="feature-card-border-glow" />
    </div>
  );
}
