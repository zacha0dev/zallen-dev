# zallen.dev

Personal portfolio and engineering journal for Zachary Allen — a Cloud & Platform Engineer focused on Azure networking, infrastructure automation, and systems that enable teams to ship reliably.

**Live site**: [systems-whisper.lovable.app](https://systems-whisper.lovable.app) (zallen.dev pending)

---

## What This Project Demonstrates

This isn't a template. It's a deliberately architected portfolio that reflects how I approach engineering problems:

- **Systems thinking over feature checklists** — The architecture prioritizes maintainability and clear separation of concerns, not framework maximalism.
- **Content as engineering artifact** — Decision logs, architecture notes, and methodology documentation live alongside code, not in a CMS.
- **Restraint as design principle** — Minimalist aesthetic, no backend dependencies, static-first delivery. Complexity is earned, not assumed.
- **AI as accelerator, not author** — AI tools (including Lovable) were used to increase velocity, but every decision was intentional and reviewed.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + CSS custom properties |
| Components | shadcn/ui (Radix primitives) |
| Animation | Framer Motion |
| Routing | React Router v6 |
| Deployment | Lovable Cloud (static hosting) |

### Why This Stack?

- **React + TypeScript**: Type safety and ecosystem maturity for maintainable frontend code
- **Vite**: Fast development feedback loops, optimized production builds
- **Tailwind + shadcn/ui**: Design system consistency without framework lock-in
- **Framer Motion**: Declarative animations that enhance without overwhelming
- **No backend**: Intentional constraint — content changes require code changes, creating an audit trail

---

## Architecture

```
src/
├── components/
│   ├── layout/          # Header, Footer, Layout wrapper
│   ├── ui/              # shadcn/ui primitives
│   └── [animations]     # Motion components (FadeIn, StaggerContainer, etc.)
├── pages/
│   ├── projects/        # Individual project deep-dives
│   └── [routes]         # Home, About, Projects, Notes, Decisions, Resume, HowIWork
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
└── index.css            # Design tokens and global styles
```

### Key Patterns

- **Semantic design tokens**: Colors defined as CSS custom properties, consumed via Tailwind
- **Staggered animations**: Content reveals progressively using Framer Motion variants
- **Static content in code**: All portfolio content lives in TypeScript, enabling type-checking and refactoring support
- **Route-based code splitting**: Each page is a discrete module, improving initial load performance

---

## Local Development

### Prerequisites

- Node.js 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm or bun

### Quick Start

```bash
# Clone the repository
git clone https://github.com/zacha0dev/zallen-portfolio.git
cd zallen-portfolio

# Install dependencies
npm install

# Start development server
npm run dev
```

The site will be available at `http://localhost:5173`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest test suite |

---

## Performance & SEO

### Performance Considerations

- **Static-first**: No SSR complexity, pure client-side rendering with optimized bundles
- **Code splitting**: Route-based lazy loading via React Router
- **Minimal dependencies**: Careful selection of runtime dependencies
- **Optimized fonts**: System font stack with optional web font loading

### SEO Implementation

- Semantic HTML structure (`<header>`, `<main>`, `<section>`, `<article>`)
- Proper heading hierarchy (single `<h1>` per page)
- Meta tags for title, description, and Open Graph
- Favicon and touch icons configured
- `robots.txt` for crawler guidance

---

## Deployment

The site is deployed via Lovable Cloud, which provides:

- Automatic deployments on push
- Global CDN distribution
- SSL/TLS certificates
- Custom domain support

For self-hosting, the `dist/` output from `npm run build` can be deployed to any static hosting provider (Vercel, Netlify, Cloudflare Pages, S3 + CloudFront, etc.).

---

## Documentation

Engineering documentation lives in `/docs`:

| Document | Description |
|----------|-------------|
| [01-vision.md](docs/01-vision.md) | Intent and direction of the portfolio |
| [02-decisions.md](docs/02-decisions.md) | Key technical and design decisions |
| [03-evolution.md](docs/03-evolution.md) | Roadmap and future iterations |
| [04-ai-workflow.md](docs/04-ai-workflow.md) | How AI tools are used responsibly |

---

## Screenshots

> Screenshots to be added after final design review

| Page | Preview |
|------|---------|
| Home | _placeholder_ |
| Projects | _placeholder_ |
| Architecture Deep-Dive | _placeholder_ |

---

## Roadmap

### Near-term
- [ ] Connect custom domain (zallen.dev)
- [ ] Add more architecture deep-dives
- [ ] Implement dark/light theme toggle refinements

### Medium-term
- [ ] Add project filtering/categorization
- [ ] Performance monitoring integration
- [ ] Automated accessibility testing in CI

### Long-term
- [ ] Technical blog integration (likely static markdown)
- [ ] Interactive architecture diagrams
- [ ] Case study expansion with measurable outcomes

---

## About the Author

**Zachary Allen** — Cloud & Platform Engineer focused on Azure networking, infrastructure automation, and enabling engineering teams to ship reliably.

- [GitHub](https://github.com/zacha0dev)
- [LinkedIn](https://www.linkedin.com/in/zacharythomasallen/)

---

## License

This project is open source for educational and portfolio purposes. Feel free to reference the architecture and patterns, but please don't directly copy the personal content.
