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
      </motion.div>

      <motion.div
        className="mt-12 max-w-2xl space-y-6 text-lg leading-relaxed text-foreground/90"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      >
        <p>
          Cloud and software engineer with deep experience in Azure networking, 
          infrastructure, and production system troubleshooting. I work across 
          network, platform, and application layers to diagnose complex, 
          multi-layer issues and translate business impact into clear technical actions.
        </p>
        <p>
          My background spans enterprise cloud platforms and customer-facing 
          production support, with a focus on reliability, systems thinking, 
          and large-scale distributed environments.
        </p>
        <p>
          Outside of day-to-day work, I build and explore applications and 
          platforms to deepen my understanding of platform engineering, system 
          architecture, and modern cloud and AI infrastructure.
        </p>
      </motion.div>
    </section>
  );
}
