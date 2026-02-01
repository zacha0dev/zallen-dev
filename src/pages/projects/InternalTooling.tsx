import { FadeIn } from "@/components/FadeIn";
import { NavLink } from "@/components/NavLink";
import { ArrowLeft } from "lucide-react";

export default function InternalToolingArchitecture() {
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
          Internal Tooling & Automation
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
                Operational work accumulates friction: repeated manual steps, 
                context-switching during incidents, and knowledge trapped in 
                individual memory. These inefficiencies compound over time, 
                reducing capacity for meaningful engineering work.
              </p>
              <p>
                The constraint is building tools that genuinely reduce toil 
                without introducing new maintenance burdens. Automation that 
                requires constant care doesn't solve problems—it relocates them.
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
                <strong className="text-foreground">Boring technology choices.</strong>{" "}
                Python for CLI tools (ubiquitous, readable), PowerShell for Windows/Azure 
                integration (native support), shell scripts for simple glue. No exotic 
                languages that require special knowledge to maintain.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Self-documenting where possible.</strong>{" "}
                Tools include help text, examples, and dry-run modes. Documentation 
                that requires separate maintenance always drifts from reality.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Fail loudly and clearly.</strong>{" "}
                Error messages explain what went wrong, what the tool expected, and 
                what to try next. Silent failures are the enemy of operational clarity.
              </li>
              <li className="border-l-2 border-border pl-4">
                <strong className="text-foreground">Composable over comprehensive.</strong>{" "}
                Small tools that do one thing well, designed to work together. A Swiss 
                Army knife is useful; a tool that tries to be everything becomes nothing.
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
                <p className="font-medium text-foreground">CLI vs. Web Dashboard</p>
                <p className="mt-1">
                  CLI tools for automation and power users, simple web dashboards 
                  only for status visibility. Web interfaces require more maintenance 
                  and often add latency to workflows that benefit from keyboard-driven 
                  speed.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <p className="font-medium text-foreground">Pull vs. Push Metrics</p>
                <p className="mt-1">
                  Prometheus-style pull for infrastructure metrics (better failure 
                  modes), push for event-driven alerts and logs. The choice depends 
                  on what question you're trying to answer and how quickly.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <p className="font-medium text-foreground">Runbook vs. Automation</p>
                <p className="mt-1">
                  Some operations benefit from human judgment during execution. 
                  Runbooks with clear decision points for those; full automation 
                  only for operations with well-understood failure modes.
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
                  Build a unified CLI that wraps common operations across tools, 
                  reducing context-switching during incident response.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground">→</span>
                <span>
                  Add structured output (JSON) to all tools for easier integration 
                  with dashboards and other automation.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground">→</span>
                <span>
                  Implement health check aggregation that surfaces system status 
                  at a glance without digging through multiple dashboards.
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
              <pre>{`┌──────────────────────────────────────────────────────────────────┐
│                        Operator Workflow                         │
└──────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │   CLI     │   │  Scripts  │   │  Alerts   │
        │   Tools   │   │  Library  │   │  Hooks    │
        └───────────┘   └───────────┘   └───────────┘
                │               │               │
                └───────────────┼───────────────┘
                                ▼
        ┌──────────────────────────────────────────────────────────┐
        │                    Azure Resources                       │
        │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
        │   │   VMs   │  │   AKS   │  │  SQL DB │  │ Storage │    │
        │   └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
        └──────────────────────────────────────────────────────────┘
                                │
                                ▼
        ┌──────────────────────────────────────────────────────────┐
        │                   Observability Layer                    │
        │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
        │   │ Prometheus  │  │   Grafana   │  │   Loki      │     │
        │   │  (Metrics)  │  │ (Dashboards)│  │   (Logs)    │     │
        │   └─────────────┘  └─────────────┘  └─────────────┘     │
        └──────────────────────────────────────────────────────────┘`}</pre>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
