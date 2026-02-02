import { motion } from "framer-motion";
import { NavLink } from "@/components/NavLink";
import { ArrowRight } from "lucide-react";

interface Project {
  title: string;
  slug: string;
  description: string;
  approach: string;
  technologies: string[];
}

const projects: Project[] = [
  {
    title: "GreenplateAi",
    slug: "greenplateai",
    description:
      "An evolving platform foundation used as a deliberate practice environment to explore system design, automation, and scalable architecture across frontend, backend, and cloud infrastructure.",
    approach:
      "Iterating on real deployment pipelines, refining infrastructure patterns, and validating architectural decisions through hands-on implementation. Each iteration surfaces new constraints and informs the next design cycle.",
    technologies: ["Azure", "Terraform", "TypeScript", "React", "PostgreSQL", "GitHub Actions"],
  },
  {
    title: "Azure Networking Labs",
    slug: "azure-networking-labs",
    description:
      "Reproducible Azure networking labs used to validate enterprise WAN, routing, DNS, and application delivery patterns through infrastructure as code and automation.",
    approach:
      "Building isolated lab environments to test hub-spoke topologies, DNS resolution flows, and traffic routing behaviors. Each lab reinforces networking fundamentals while exploring edge cases in real infrastructure.",
    technologies: ["Azure", "Terraform", "Virtual WAN", "Private DNS", "Application Gateway", "Bicep"],
  },
  {
    title: "Internal Tooling & Automation",
    slug: "internal-tooling",
    description:
      "Internal tools and workflows built to reduce operational friction, accelerate diagnosis, and refine platform and systems engineering practices.",
    approach:
      "Developing CLI utilities, automation scripts, and monitoring integrations that address recurring operational patterns. Focus on reducing toil and improving clarity during incident response and infrastructure changes.",
    technologies: ["Python", "PowerShell", "Azure CLI", "Prometheus", "Grafana"],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

export default function Projects() {
  return (
    <section className="container py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Projects
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Engineering systems and practice environments focused on architectural 
          exploration, iteration, and learning through real constraints.
        </p>
      </motion.div>

      <motion.div
        className="mt-16 grid gap-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {projects.map((project) => (
          <motion.article
            key={project.title}
            className="group rounded-lg border border-border bg-card p-8 transition-colors hover:border-accent/50"
            variants={itemVariants}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
          >
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

            <NavLink
              to={`/projects/${project.slug}`}
              className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group/link"
            >
              <span className="relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-accent after:transition-all after:duration-300 group-hover/link:after:w-full">
                Architecture Notes
              </span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
            </NavLink>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
