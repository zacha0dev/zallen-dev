import { motion } from "framer-motion";
import { ParticleConstellation } from "@/components/ParticleConstellation";

export default function Home() {
  return (
    <>
      <ParticleConstellation />
      <section className="container relative z-10 flex min-h-[calc(100vh-10rem)] sm:min-h-[calc(100vh-5rem)] flex-col justify-center py-8 sm:py-0">
        <div className="relative">
          {/* Subtle backdrop to ensure text readability */}
          <div className="absolute -inset-x-8 -inset-y-4 bg-gradient-to-r from-background via-background/95 to-background/80 blur-xl -z-10" />
          
          <motion.h1
            className="text-4xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
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
            Cloud & Software Engineer
          </motion.p>

          <motion.p
            className="mt-6 sm:mt-8 max-w-2xl text-base sm:text-lg leading-relaxed text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            I work across network, platform, and application layers - diagnosing 
            complex issues and translating business impact into clear technical action. 
            Outside of work, I build to learn: exploring platform engineering, system 
            architecture, and modern cloud infrastructure.
          </motion.p>
        </div>
      </section>
    </>
  );
}
