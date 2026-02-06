import { motion } from "framer-motion";

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

export default function HowIWork() {
  return (
    <section className="container py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          How I Work
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          An overview of working style and engineering focus.
        </p>
      </motion.div>

      <motion.div
        className="mt-16 max-w-2xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <h2 className="text-xl font-medium tracking-tight text-foreground mb-6">
            What will be here
          </h2>
          <ul className="space-y-3 text-foreground/90">
            <li className="flex gap-3">
              <span className="text-muted-foreground">•</span>
              <span>Problem solving approach</span>
            </li>
            <li className="flex gap-3">
              <span className="text-muted-foreground">•</span>
              <span>Collaboration and communication style</span>
            </li>
            <li className="flex gap-3">
              <span className="text-muted-foreground">•</span>
              <span>Technical priorities and focus areas</span>
            </li>
            <li className="flex gap-3">
              <span className="text-muted-foreground">•</span>
              <span>Tools and technologies</span>
            </li>
          </ul>
        </motion.div>

        <motion.p
          className="mt-12 text-muted-foreground"
          variants={itemVariants}
        >
          This section is being developed.
        </motion.p>
      </motion.div>
    </section>
  );
}
