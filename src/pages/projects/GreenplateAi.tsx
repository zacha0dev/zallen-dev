import { FadeIn } from "@/components/FadeIn";
import { NavLink } from "@/components/NavLink";
import { ArrowLeft } from "lucide-react";

export default function GreenplateAiArchitecture() {
  return (
    <section className="container py-16">
      <FadeIn>
        <NavLink
          to="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </NavLink>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          GreenplateAi
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Architecture Notes
        </p>
      </FadeIn>

      <div className="mt-16 space-y-12">
        <FadeIn delay={100}>
          <article className="space-y-4">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Problem Constraints
            </h2>
            <div className="text-foreground/90 leading-relaxed space-y-3">
              <p>
                The core challenge was building a platform foundation that could evolve 
                without accumulating technical debt. Most early-stage systems are built 
                under pressure to ship features, leading to architectures that resist 
                change as requirements grow.
              </p>
              <p>
                Additional constraints included: limited budget for infrastructure 
                experimentation, the need to integrate multiple cloud services without 
                vendor lock-in, and maintaining development velocity while establishing 
                solid operational foundations.
              </p>
            </div>
          </article>
        </FadeIn>

        <FadeIn delay={200}>
          <article className="space-y-4">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Key Design Decisions
            </h2>
            <ul className="space-y-4 text-foreground/90 leading-relaxed">
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Infrastructure as Code first.</strong>{" "}
                Every resource is defined in Terraform before manual creation is considered. 
                This creates a reproducible baseline and forces intentional decisions about 
                resource dependencies.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Monorepo with clear boundaries.</strong>{" "}
                Frontend, backend, and infrastructure live in one repository but with strict 
                separation. Shared types and utilities are explicitly exported, preventing 
                accidental coupling.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Environment parity from day one.</strong>{" "}
                Development, staging, and production environments use identical infrastructure 
                definitions with environment-specific variables. No "works on my machine" gaps.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">GitHub Actions for everything.</strong>{" "}
                CI/CD pipelines handle not just deployments but infrastructure validation, 
                security scanning, and automated documentation generation.
              </li>
            </ul>
          </article>
        </FadeIn>

        <FadeIn delay={300}>
          <article className="space-y-4">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Tradeoffs Considered
            </h2>
            <div className="space-y-4 text-foreground/90 leading-relaxed">
              <div className="border-l-2 border-border pl-4">
                <p className="font-medium text-foreground">Terraform vs. Bicep</p>
                <p className="mt-1">
                  Chose Terraform for multi-cloud portability despite Azure-native Bicep offering 
                  tighter integration. The tradeoff is slightly more verbose configuration for 
                  significantly more flexibility in future cloud decisions.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <p className="font-medium text-foreground">PostgreSQL vs. Managed NoSQL</p>
                <p className="mt-1">
                  PostgreSQL provides relational guarantees and mature tooling at the cost of 
                  more careful schema evolution. For a platform with structured data relationships, 
                  the operational overhead is worth the consistency guarantees.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <p className="font-medium text-foreground">Simplicity vs. Observability</p>
                <p className="mt-1">
                  Invested early in structured logging and basic metrics collection. This adds 
                  complexity but provides critical visibility during incident response and 
                  capacity planning.
                </p>
              </div>
            </div>
          </article>
        </FadeIn>

        <FadeIn delay={400}>
          <article className="space-y-4">
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              What I'd Change Next
            </h2>
            <ul className="space-y-3 text-foreground/90 leading-relaxed">
              <li className="flex gap-3">
                <span className="text-muted-foreground">→</span>
                <span>
                  Migrate from manual Terraform applies to a GitOps workflow with Atlantis 
                  for better audit trails and team collaboration.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground">→</span>
                <span>
                  Implement feature flags infrastructure to enable safer rollouts and 
                  A/B testing without deployment coupling.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground">→</span>
                <span>
                  Add distributed tracing to better understand request flows across 
                  service boundaries as the system grows.
                </span>
              </li>
            </ul>
          </article>
        </FadeIn>

        <FadeIn delay={500}>
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-medium tracking-tight text-foreground mb-6">
              Current System Snapshot
            </h2>
            <div className="bg-card border border-border rounded-lg p-6 font-mono text-sm text-foreground/80 overflow-x-auto">
              <pre>{`┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                          │
│                    (CI/CD, Security Scans)                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Terraform State (Azure)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   Frontend    │       │    Backend    │       │  PostgreSQL   │
│   (React)     │◄─────►│  (TypeScript) │◄─────►│   Database    │
│   Static CDN  │       │   App Service │       │   Managed     │
└───────────────┘       └───────────────┘       └───────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Monitoring Stack    │
                    │  (Logs, Metrics)      │
                    └───────────────────────┘`}</pre>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
