import type { Metadata } from "next";
import { CvAnalyzer } from "@/components/cv-analyzer";

export const metadata: Metadata = {
  title: "Local CV Analyzer | Job Toolkit",
  description: "Rate your CV against selected guidelines with a local Ollama model.",
};

export default function CvAnalyzerPage() {
  return <CvAnalyzer />;
}
