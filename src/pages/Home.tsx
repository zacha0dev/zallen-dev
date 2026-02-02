import { motion } from "framer-motion";
import { ParticleConstellation } from "@/components/ParticleConstellation";

export default function Home() {
  return (
    <>
      <ParticleConstellation />
      <section className="container relative z-10 flex min-h-[calc(100vh-5rem)] flex-col justify-center">
        <div className="relative">
          {/* Subtle backdrop to ensure text readability */}
          <div className="absolute -inset-x-8 -inset-y-4 bg-gradient-to-r from-background via-background/95 to-background/80 blur-xl -z-10" />
          
          <motion.h1
            className="text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Zachary Allen
          </motion.h1>

          <motion.p
            className="mt-4 text-xl text-muted-foreground sm:text-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          >
            Cloud & Platform Engineer
            <span className="hidden sm:inline"> (Solutions-Focused)</span>
          </motion.p>

          <motion.p
            className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            I design and operate production systems that other teams build on. My work 
            focuses on cloud foundations, platform workflows, and architectures that 
            scale cleanly while remaining stable under pressure.
          </motion.p>
        </div>
      </section>
    </>
  );
}
