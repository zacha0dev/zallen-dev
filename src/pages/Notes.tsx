import { motion } from "framer-motion";
import { NavLink } from "@/components/NavLink";
import { StaggerContainer, StaggerItem } from "@/components/StaggerContainer";

interface Note {
  title: string;
  date: string;
  content: string;
}

const notes: Note[] = [
  {
    title: "Designing systems before users exist",
    date: "January 2026",
    content:
      "Building platform foundations without immediate user pressure creates space for architectural clarity. The tradeoff is real: without feedback loops, it's easy to over-engineer or optimize for the wrong constraints. But there's value in treating early systems as deliberate practice—making decisions, observing consequences, and refining judgment through iteration. The goal isn't perfection before launch; it's developing the instincts to recognize good structure when it matters.",
  },
  {
    title: "The cost of not automating",
    date: "December 2025",
    content:
      "Manual processes have hidden costs beyond time. Each repetition reinforces muscle memory for the wrong things—clicking through consoles instead of reasoning about systems. Automation isn't just efficiency; it's forcing clarity about what a process actually does. Writing a script requires understanding every step. The script becomes documentation, the execution becomes repeatable, and the knowledge transfers beyond individual memory.",
  },
];

export default function Notes() {
  return (
    <section className="container py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Notes
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Reflections on architectural decisions, system tradeoffs, 
          and the practice of building reliable infrastructure.
        </p>
      </motion.div>

      <StaggerContainer className="mt-16 space-y-12" staggerDelay={0.1}>
        {notes.map((note) => (
          <StaggerItem key={note.title}>
            <article className="border-l-2 border-border pl-6 hover:border-accent/50 transition-colors">
              <time className="text-sm text-muted-foreground">{note.date}</time>
              <h2 className="mt-2 text-xl font-medium tracking-tight">
                {note.title}
              </h2>
              <p className="mt-4 text-foreground/90 leading-relaxed">
                {note.content}
              </p>
            </article>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <motion.div
        className="mt-16 pt-8 border-t border-border"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <p className="text-muted-foreground">
          See also:{" "}
          <NavLink
            to="/decisions"
            className="text-foreground hover:text-accent transition-colors underline underline-offset-4"
          >
            Decision Log
          </NavLink>
          {" "}— specific technical decisions with context and outcomes.
        </p>
      </motion.div>
    </section>
  );
}
