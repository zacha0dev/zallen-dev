
# Cloud & Platform Engineer Portfolio

A multi-page, dark-themed portfolio website designed to communicate systems-level engineering expertise with quiet confidence. Multi-page structure provides clear separation of concerns while maintaining a cohesive, understated aesthetic throughout.

---

## Visual Design

**Color Palette**
- Background: Matte black (#0a0a0a)
- Primary text: Warm off-white (#e8e4df)
- Secondary text: Muted gray (#6b6b6b)
- Links/hover: Subtle graphite accent (#8a8a8a)

**Typography**
- Clean sans-serif stack (Inter or system fonts)
- Tight letter-spacing on headings
- Comfortable line-height (1.6-1.7) for body text
- Editorial sizing with clear hierarchy

**Motion**
- Gentle fade-in on page load and scroll
- Smooth transitions between states
- Subtle hover effects on interactive elements

---

## Pages & Navigation

### Global Navigation
Minimal header with name/logo and navigation links. Understated styling — no background, just typography. Links to: Home, Projects, Notes, About, Resume.

### Home (`/`)
Full viewport hero. Name in large confident type. Role: "Cloud & Platform Engineer (Solutions-Focused)". One positioning statement about systems thinking and platform ownership. No buttons, no photo — pure identity.

### Projects (`/projects`)
3–4 engineering projects as clean cards. Each displays: project name, system problem description, architectural approach, and technologies. Emphasis on decisions and tradeoffs. No screenshots — narrative focus.

### Notes (`/notes`)
2–3 engineering reflections. Each with title, date, and a short paragraph on architectural decisions or operational lessons. Signals ongoing technical thinking.

### About (`/about`)
3–4 sentences of professional background. Systems orientation, platform engineering, technical ownership. Text-first, no personal anecdotes. Optional grayscale photo.

### Resume (`/resume`)
Lightweight page with brief summary and PDF download link. No full resume duplication.

### Global Footer
Centered on all pages. Three links: GitHub, LinkedIn, Resume. Minimal copyright.

---

## Technical Implementation

- React Router for multi-page navigation
- Shared layout component with header and footer
- Custom CSS properties for dark theme colors
- Intersection Observer hook for fade-in animations
- Mobile-first responsive design
- Static content editable in code
- No backend, CMS, or forms
