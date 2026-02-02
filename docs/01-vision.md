# Vision: zallen.dev

## Intent

This portfolio exists to demonstrate how I think about systems, not just what I've built.

Most engineering portfolios focus on outputs — project screenshots, feature lists, technology badges. This one focuses on process: how problems are framed, how tradeoffs are evaluated, how decisions compound over time.

The goal is to give technical reviewers (hiring managers, engineering leads, potential collaborators) a clear signal about:

1. **How I approach ambiguity** — Real engineering work rarely arrives with clear requirements
2. **How I reason about tradeoffs** — Every technical decision has costs and benefits
3. **How I communicate technical concepts** — The best solutions fail if no one understands them
4. **How I invest in long-term maintainability** — Code that works today but breaks tomorrow isn't valuable

---

## Who This Is For

**Primary audience**: Engineering leaders evaluating candidates for mid-to-senior platform/infrastructure roles

They're looking for:
- Evidence of systems thinking beyond isolated features
- Clear technical communication
- Demonstrated ownership and follow-through
- Judgment about when to build vs. buy vs. defer

**Secondary audience**: Fellow engineers interested in architecture patterns and engineering practice

They might find value in:
- The decision log format for documenting technical choices
- The "How I Work" framework for articulating engineering philosophy
- The project deep-dive structure for presenting technical work

---

## Design Philosophy

### Restraint Over Embellishment

The aesthetic is intentionally minimal. Matte black background, warm off-white text, generous whitespace. No hero images, no particle effects, no "engaging" animations that distract from content.

This restraint signals something about my engineering values: complexity should be earned, not assumed. The same principle applies to infrastructure architecture.

### Content as First-Class Citizen

Every piece of content on the site could live in a rich text editor or CMS. Instead, it lives in TypeScript files.

This is intentional:
- Content changes create git commits, providing an audit trail
- Type checking catches structural errors in content
- Refactoring tools work across content and code
- No backend dependencies to maintain or secure

The tradeoff is clear: content updates require code changes. For a personal portfolio with infrequent updates, this is acceptable. For a blog with daily posts, it wouldn't be.

### Static-First Architecture

No database. No server-side rendering. No authentication. No contact forms.

Each of these was a conscious decision to exclude. The portfolio doesn't need dynamic content, and adding backend complexity would create:
- Additional attack surface
- Ongoing maintenance burden
- Deployment complexity
- Potential availability issues

The site is a collection of HTML, CSS, and JavaScript files served from a CDN. It loads fast, stays available, and requires no ongoing operational attention.

---

## What Success Looks Like

**Short-term**: A polished, professional presence that accurately represents my engineering capabilities and philosophy.

**Medium-term**: A living document that evolves with my career — new projects, refined thinking, accumulated decision logs.

**Long-term**: A body of work that demonstrates consistent growth, clear communication, and systems thinking over years, not just a snapshot of current capabilities.

---

## What This Is Not

- **Not a tutorial site**: The content assumes technical context; it's not written to teach fundamentals
- **Not a blog**: Notes and decisions are reflections, not SEO-optimized content marketing
- **Not a product showcase**: Projects are presented as engineering explorations, not commercial offerings
- **Not a job application substitute**: The portfolio complements a resume and interview process; it doesn't replace them
