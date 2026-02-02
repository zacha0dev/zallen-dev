# Technical & Design Decisions

This document captures key decisions made during the development of zallen.dev, including context, alternatives considered, and rationale.

---

## Decision: Static React SPA Over SSR/SSG Frameworks

**Date**: January 2026  
**Status**: Accepted

### Context

The portfolio needs to be fast, reliable, and low-maintenance. Options considered:
- **Next.js (SSR/SSG)**: Full-featured React framework with server-side capabilities
- **Astro**: Content-focused static site generator with partial hydration
- **Gatsby**: React-based SSG with GraphQL data layer
- **Plain React SPA**: Client-side rendered React application

### Decision

Use a plain React SPA built with Vite.

### Rationale

- **No server-side requirements**: All content is static; SSR provides no SEO benefit for this use case
- **Reduced complexity**: No framework-specific patterns, data layers, or build configurations
- **Vite performance**: HMR and build times are excellent without framework overhead
- **Deployment flexibility**: Any static host works; no serverless functions or edge runtime needed
- **Familiarity**: React patterns are widely understood; no framework-specific knowledge required for maintenance

### Tradeoffs Accepted

- No automatic code-splitting by route (implemented manually via React.lazy if needed)
- No built-in image optimization (not needed for text-focused portfolio)
- Initial JavaScript bundle must load before content renders (acceptable for portfolio use case)

---

## Decision: Tailwind CSS with shadcn/ui

**Date**: January 2026  
**Status**: Accepted

### Context

Need a styling approach that provides:
- Design system consistency
- Rapid development velocity
- Long-term maintainability
- Dark mode support

### Decision

Use Tailwind CSS for utility-based styling, shadcn/ui for component primitives, and CSS custom properties for design tokens.

### Rationale

- **Tailwind**: Utility classes eliminate context-switching between files; design constraints are built into the class names
- **shadcn/ui**: Copy-paste components (not npm dependencies) provide full control and accessibility out of the box
- **CSS custom properties**: Semantic tokens (`--foreground`, `--background`, `--accent`) enable theming without class changes

### Tradeoffs Accepted

- Learning curve for Tailwind's utility-first approach
- Larger HTML with repeated utility classes (mitigated by component extraction)
- shadcn/ui components require manual updates (but also enable customization)

---

## Decision: Content in TypeScript, Not CMS

**Date**: January 2026  
**Status**: Accepted

### Context

Portfolio content (projects, notes, decisions) needs to be authored and maintained. Options:
- **Headless CMS**: Contentful, Sanity, Strapi
- **Markdown files**: MDX with frontmatter
- **TypeScript objects**: Content defined as typed data structures

### Decision

Define all content as TypeScript objects within the codebase.

### Rationale

- **Type safety**: Content structure is enforced at compile time
- **Refactoring support**: IDE tooling works across content and code
- **Git history**: Content changes are commits with full context
- **No dependencies**: No external service to configure, secure, or pay for
- **Colocation**: Content lives next to the components that render it

### Tradeoffs Accepted

- Content updates require code changes and deployment
- No WYSIWYG editing for non-technical contributors (not a concern for personal portfolio)
- No content versioning beyond git history

---

## Decision: Framer Motion for Animations

**Date**: January 2026  
**Status**: Accepted

### Context

Animations should enhance the reading experience without overwhelming. Need:
- Page transitions
- Staggered list reveals
- Subtle hover interactions
- Scroll-based effects (progress indicator)

### Decision

Use Framer Motion for all animations.

### Rationale

- **Declarative API**: Animations defined as React props, not imperative code
- **Layout animations**: AnimatePresence handles mount/unmount transitions
- **Variants system**: Coordinated animations across component trees
- **Performance**: Hardware-accelerated transforms and opacity changes
- **React integration**: Works naturally with React's component model

### Tradeoffs Accepted

- Bundle size increase (~30KB gzipped)
- Additional abstraction layer over CSS animations
- Learning curve for variant composition patterns

---

## Decision: Minimal Navigation Structure

**Date**: January 2026  
**Status**: Accepted

### Context

Portfolio has multiple content types (projects, notes, decisions, methodology, about, resume). Navigation structure options:
- Flat list of all pages
- Nested hierarchy with dropdowns
- Contextual navigation within sections

### Decision

Flat header navigation with primary pages (Projects, Notes, How I Work, About) plus contextual links within content.

### Rationale

- **Discoverability**: All primary content accessible from any page
- **Simplicity**: No cognitive load from nested menus
- **Mobile-friendly**: Hamburger menu works for flat structure
- **Content linking**: Decision Log linked from Notes, not primary nav (secondary content)

### Tradeoffs Accepted

- Resume not in primary nav (accessible from About or direct link)
- Deep-dive pages require navigating through Projects first
- May need restructuring as content grows

---

## Decision: No Contact Form

**Date**: January 2026  
**Status**: Accepted

### Context

Portfolios often include contact forms. This requires:
- Backend to receive form submissions
- Email service integration
- Spam protection (CAPTCHA, rate limiting)
- Error handling and feedback

### Decision

No contact form. Social links (LinkedIn, GitHub) serve as contact channels.

### Rationale

- **Reduced complexity**: No backend, no email configuration, no spam to manage
- **Professional channels**: LinkedIn messages are more appropriate for professional contact
- **No maintenance**: Form backends require ongoing attention and cost
- **Signal filtering**: LinkedIn's existing features handle spam and provide context

### Tradeoffs Accepted

- Friction for casual inquiries (acceptable; prioritizing signal over volume)
- No ability to collect leads or newsletter signups (not a goal for this portfolio)

---

## Decision: Engineering Journal Format

**Date**: January 2026  
**Status**: Accepted

### Context

Need to present work in a way that demonstrates engineering thinking, not just outputs. Options:
- Traditional portfolio with project cards and descriptions
- Blog with technical posts
- Engineering journal with decision logs and methodology documentation

### Decision

Hybrid approach: project cards link to architecture deep-dives, supplemented by Notes (reflections) and Decisions (technical choices) sections.

### Rationale

- **Shows thinking process**: Decision logs reveal how choices were made, not just what was built
- **Demonstrates communication**: Technical writing is a core engineering skill
- **Living document**: Format supports ongoing additions without restructuring
- **Differentiation**: Most portfolios don't expose this level of engineering reflection

### Tradeoffs Accepted

- More content to maintain
- Requires ongoing documentation discipline
- May be too detailed for some reviewers (acceptable; targeting technical evaluators)
