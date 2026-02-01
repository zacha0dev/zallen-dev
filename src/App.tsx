import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Notes from "./pages/Notes";
import Decisions from "./pages/Decisions";
import About from "./pages/About";
import Resume from "./pages/Resume";
import HowIWork from "./pages/HowIWork";
import GreenplateAiArchitecture from "./pages/projects/GreenplateAi";
import AzureNetworkingLabsArchitecture from "./pages/projects/AzureNetworkingLabs";
import InternalToolingArchitecture from "./pages/projects/InternalTooling";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/greenplateai" element={<GreenplateAiArchitecture />} />
            <Route path="/projects/azure-networking-labs" element={<AzureNetworkingLabsArchitecture />} />
            <Route path="/projects/internal-tooling" element={<InternalToolingArchitecture />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/decisions" element={<Decisions />} />
            <Route path="/about" element={<About />} />
            <Route path="/resume" element={<Resume />} />
            <Route path="/how-i-work" element={<HowIWork />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
