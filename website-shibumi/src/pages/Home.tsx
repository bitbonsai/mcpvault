/**
 * Home page. Ported from pages/index.astro.
 *
 * Composition matches the Astro source exactly: Nav, SpecPreviewCallout,
 * Hero, UpdateCallout, NewsletterSignup, Footer, in that order, inside
 * `<main id="main-content">`. `ComparisonTable`/`FeatureGrid`/`FAQ`/
 * `CodeExample` are Features-page components (`FeatureGrid`/`FAQ` are only
 * ever imported by features.astro) and are out of scope for this group;
 * they land with the Features route in the next Phase 2 group.
 *
 * `clientScript="/client/alpine.js"` (Phase 3): `Nav`'s mobile menu and
 * `NewsletterSignup`'s submission state both name Alpine.data() modules now.
 */
import { Footer } from "../components/Footer";
import { Hero } from "../components/Hero";
import { Nav } from "../components/Nav";
import { NewsletterSignup } from "../components/NewsletterSignup";
import { SpecPreviewCallout } from "../components/SpecPreviewCallout";
import { UpdateCallout } from "../components/UpdateCallout";
import { Layout } from "../layouts/Layout";

export interface HomePageProps {
  currentPath: string;
  version: string;
  turnstileSiteKey?: string;
}

export function HomePage({ currentPath, version, turnstileSiteKey }: HomePageProps) {
  return (
    <Layout page="home" pageStylesheet="/styles/home.css" clientScript="/client/alpine.js" version={version}>
      <Nav currentPath={currentPath} version={version} />

      <main id="main-content">
        <SpecPreviewCallout />
        <Hero version={version} />
        <UpdateCallout />
        <NewsletterSignup turnstileSiteKey={turnstileSiteKey} />
        <Footer />
      </main>
    </Layout>
  );
}
