import { FadeIn } from "@/components/FadeIn";

interface Project {
  title: string;
  problem: string;
  approach: string;
  technologies: string[];
}

const projects: Project[] = [
  {
    title: "Multi-Region Kubernetes Platform",
    problem:
      "Legacy deployment process required manual intervention across three data centers, causing 4-hour deployment windows and frequent rollback failures.",
    approach:
      "Designed a GitOps-based platform using Kubernetes and ArgoCD with automated canary deployments. Built custom controllers for cross-region traffic shifting and implemented progressive delivery pipelines that reduced deployment risk.",
    technologies: ["Kubernetes", "ArgoCD", "Istio", "Go", "Terraform"],
  },
  {
    title: "Observability Infrastructure",
    problem:
      "Distributed system with 200+ microservices lacked unified visibility. Teams operated in silos with inconsistent logging and no correlation between traces, metrics, and logs.",
    approach:
      "Built a centralized observability stack with OpenTelemetry instrumentation. Designed custom dashboards and alerting hierarchies that reduced mean-time-to-detection from 45 minutes to under 3 minutes.",
    technologies: ["OpenTelemetry", "Prometheus", "Grafana", "Loki", "Python"],
  },
  {
    title: "Developer Platform & Internal Tooling",
    problem:
      "Engineering teams spent 30% of their time on infrastructure tasks. No self-service capabilities for database provisioning, secrets management, or environment creation.",
    approach:
      "Created an internal developer platform with Backstage, abstracting infrastructure complexity behind service templates. Teams now provision complete environments in minutes with full compliance guardrails.",
    technologies: ["Backstage", "Crossplane", "Vault", "PostgreSQL", "TypeScript"],
  },
  {
    title: "Zero-Trust Network Architecture",
    problem:
      "Flat network topology with perimeter-based security. Lateral movement risk was high, and compliance audits repeatedly flagged segmentation gaps.",
    approach:
      "Implemented service mesh with mTLS everywhere. Designed identity-based access policies that replaced IP-based rules. Achieved SOC 2 compliance with automated policy enforcement.",
    technologies: ["Cilium", "SPIFFE/SPIRE", "Envoy", "OPA", "Terraform"],
  },
];

export default function Projects() {
  return (
    <section className="container py-16">
      <FadeIn>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Projects
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Selected engineering work focused on platform infrastructure, 
          developer experience, and systems reliability.
        </p>
      </FadeIn>

      <div className="mt-16 grid gap-8">
        {projects.map((project, index) => (
          <FadeIn key={project.title} delay={index * 100}>
            <article className="group rounded-lg border border-border bg-card p-8 transition-all hover:border-accent/50 hover:translate-y-[-2px]">
              <h2 className="text-2xl font-medium tracking-tight">
                {project.title}
              </h2>

              <div className="mt-6 space-y-4">
                <div>
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Problem
                  </h3>
                  <p className="mt-2 text-foreground/90">{project.problem}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Approach
                  </h3>
                  <p className="mt-2 text-foreground/90">{project.approach}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {project.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="rounded bg-secondary px-3 py-1 text-sm text-muted-foreground"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </article>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
