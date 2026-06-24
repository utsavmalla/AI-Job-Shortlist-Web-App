import Link from "next/link";
import React from "react";
import { Sparkles } from "lucide-react";

export function SiteHeader({ active }: { active: "extractor" | "cv" }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark"><Sparkles size={16} /></span>
        <span>Job Toolkit</span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link aria-current={active === "extractor" ? "page" : undefined} href="/">Job Extractor</Link>
        <Link aria-current={active === "cv" ? "page" : undefined} href="/cv-analyzer">CV Analyzer</Link>
      </nav>
    </header>
  );
}
