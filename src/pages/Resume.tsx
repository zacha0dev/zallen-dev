import { motion } from "framer-motion";
import { FileText } from "lucide-react";

export default function Resume() {
  return (
    <section className="container py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Resume
        </h1>
      </motion.div>

      <motion.div
        className="mt-12 max-w-2xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      >
        <p className="text-lg leading-relaxed text-foreground/90">
          Cloud and platform engineer with depth in Azure networking, 
          infrastructure automation, and systems design. Focused on building 
          foundations that scale cleanly and remain stable under pressure.
        </p>

        <motion.a
          href="/resume.pdf"
          download
          className="mt-8 inline-flex items-center gap-3 rounded-lg border border-border bg-card px-6 py-4 text-foreground transition-colors hover:border-accent/50"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Download Resume</p>
            <p className="text-sm text-muted-foreground">PDF</p>
          </div>
        </motion.a>
      </motion.div>
    </section>
  );
}
