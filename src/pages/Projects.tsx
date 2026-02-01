import { FadeIn } from "@/components/FadeIn";

interface Project {
  title: string;
  description: string;
  approach: string;
  technologies: string[];
}

const projects: Project[] = [
  {
    title: "GreenplateAi",
    description:
      "An evolving platform foundation used as a deliberate practice environment to explore system design, automation, and scalable architecture across frontend, backend, and cloud infrastructure.",
    approach:
      "Iterating on real deployment pipelines, refining infrastructure patterns, and validating architectural decisions through hands-on implementation. Each iteration surfaces new constraints and informs the next design cycle.",
    technologies: ["Azure", "Terraform", "TypeScript", "React", "PostgreSQL", "GitHub Actions"],
  },
  {
    title: "Azure Networking Labs",
    description:
      "Reproducible Azure networking labs used to validate enterprise WAN, routing, DNS, and application delivery patterns through infrastructure as code and automation.",
    approach:
      "Building isolated lab environments to test hub-spoke topologies, DNS resolution flows, and traffic routing behaviors. Each lab reinforces networking fundamentals while exploring edge cases in real infrastructure.",
    technologies: ["Azure", "Terraform", "Virtual WAN", "Private DNS", "Application Gateway", "Bicep"],
  },
  {
    title: "Internal Tooling & Automation",
    description:
      "Internal tools and workflows built to reduce operational friction, accelerate diagnosis, and refine platform and systems engineering practices.",
    approach:
      "Developing CLI utilities, automation scripts, and monitoring integrations that address recurring operational patterns. Focus on reducing toil and improving clarity during incident response and infrastructure changes.",
    technologies: ["Python", "PowerShell", "Azure CLI", "Prometheus", "Grafana"],
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
          Engineering systems and practice environments focused on architectural 
          exploration, iteration, and learning through real constraints.
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
                  <p className="text-foreground/90">{project.description}</p>
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
