import { motion } from "framer-motion";

export default function About() {
  return (
    <section className="container py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          About
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Background and professional focus.
        </p>
      </motion.div>

      <motion.div
        className="mt-12 max-w-2xl space-y-6 text-lg leading-relaxed text-foreground/90"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      >
        <p>
          Cloud and software engineer focused on Azure infrastructure, platform 
          engineering, and production systems.
        </p>
        <p className="text-muted-foreground">
          More details coming.
        </p>
      </motion.div>
    </section>
  );
}
