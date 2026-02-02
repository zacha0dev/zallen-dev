# Evolution: zallen.dev

This document tracks the planned evolution of the portfolio, serving as both a roadmap and a record of how thinking develops over time.

---

## Current State (v1.0)

### What Exists

- **Core pages**: Home, About, Projects, Notes, Decisions, How I Work, Resume
- **Project deep-dives**: GreenplateAi, Azure Networking Labs, Internal Tooling
- **Design system**: Matte black aesthetic, semantic tokens, Framer Motion animations
- **Infrastructure**: Static deployment via Lovable Cloud

### What Works Well

- Clean, professional presentation that matches the "executive briefing" tone
- Architecture deep-dive format effectively communicates engineering thinking
- Static architecture eliminates operational overhead
- Decision log format provides unique differentiation

### Known Limitations

- No custom domain yet (systems-whisper.lovable.app vs. zallen.dev)
- Screenshot placeholders in documentation
- Limited project catalog (3 projects)
- No analytics or performance monitoring

---

## Near-Term Iterations (1-3 months)

### Custom Domain Connection

**Priority**: High  
**Effort**: Low

Connect zallen.dev to the deployed site. This is primarily a DNS configuration task but important for professional presentation.

### Expand Project Catalog

**Priority**: High  
**Effort**: Medium

Add 2-3 additional project deep-dives covering:
- Networking lab patterns and lessons learned
- CI/CD pipeline architecture
- Monitoring and observability implementations

Each project should follow the established format: Problem Constraints → Key Decisions → Tradeoffs → What I'd Change → System Snapshot.

### Accessibility Audit

**Priority**: Medium  
**Effort**: Medium

Conduct a thorough accessibility review:
- Screen reader testing
- Keyboard navigation verification
- Color contrast validation
- Focus management in navigation

### Performance Baseline

**Priority**: Medium  
**Effort**: Low

Establish performance monitoring:
- Core Web Vitals measurement
- Bundle size tracking
- Lighthouse CI integration

---

## Medium-Term Iterations (3-6 months)

### Technical Blog Integration

**Priority**: Medium  
**Effort**: High

If deeper technical writing becomes valuable, add a blog section. Likely approach:
- Markdown files with frontmatter
- MDX for React component embedding
- RSS feed generation
- Content separate from but integrated with portfolio

This would require careful consideration of the maintenance burden vs. value proposition.

### Interactive Architecture Diagrams

**Priority**: Low  
**Effort**: High

Replace ASCII art system diagrams with interactive visualizations:
- Zoomable, pannable diagrams
- Clickable components with tooltips
- Animated data flow visualization

This is a "nice to have" that could enhance understanding but isn't critical.

### Dark/Light Theme Refinement

**Priority**: Low  
**Effort**: Medium

Current design is dark-mode focused. Consider:
- Light mode alternative for different reading contexts
- System preference detection
- Smooth theme transitions
- Ensure both themes maintain the "executive briefing" aesthetic

---

## Long-Term Vision (6-12 months)

### Case Study Expansion

Move from architecture notes to full case studies with:
- Quantified outcomes (performance improvements, cost savings, time reductions)
- Stakeholder context and business impact
- Lessons learned with specific applicability

This requires accumulating measurable results from ongoing work.

### Open Source Contributions Section

If contributing to open source becomes a significant part of the engineering practice, add:
- Contribution highlights
- Maintained projects or tools
- Community involvement

### Speaking/Writing Archive

If external technical communication (talks, guest posts, documentation) becomes relevant:
- Embedded videos or slide decks
- Links to published writing
- Context about topics and audiences

---

## Evolution Principles

### Add Intentionally

New sections or features should have clear value propositions. The portfolio should stay focused rather than becoming a catch-all.

Questions before adding:
- Does this demonstrate engineering thinking?
- Does this serve the primary audience (technical evaluators)?
- Is the maintenance burden acceptable?
- Does this fit the existing aesthetic and tone?

### Remove Courageously

Content that becomes stale, irrelevant, or no longer representative should be archived or removed. A smaller, coherent portfolio is better than a larger, scattered one.

### Document the Journey

This evolution document should be updated as changes are made. The history of decisions is as valuable as the current state.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2026 | Initial portfolio launch with core pages and 3 project deep-dives |
