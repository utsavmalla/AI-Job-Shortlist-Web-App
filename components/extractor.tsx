"use client";

import { useState } from "react";
import { Check, Clipboard, Code2, Link2, List, LoaderCircle, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import type { JobRequirements } from "@/lib/schema";
import { SiteHeader } from "@/components/site-header";

type InputType = "text" | "url";
type ApiResult = { result: JobRequirements; source: { type: InputType; url: string | null } };
type ApiError = { error?: string; code?: string; retryAfterSeconds?: number };

const emptyCopy = { text: "", url: "" };

function Value({ children }: { children: React.ReactNode }) {
  return children ? <>{children}</> : <span className="muted-value">Not stated</span>;
}

function Tags({ values }: { values: string[] }) {
  return values.length ? <div className="tags">{values.map((value) => <span key={value}>{value}</span>)}</div> : <span className="muted-value">None stated</span>;
}

function ResultRow({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="result-row"><h3>{title}</h3><div className="result-row__content">{children}</div></section>;
}

export function Extractor() {
  const [inputType, setInputType] = useState<InputType>("text");
  const [inputs, setInputs] = useState(emptyCopy);
  const [data, setData] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const content = inputs[inputType];
  const setMode = (mode: InputType) => { setInputType(mode); setError(""); };
  const clear = () => { setInputs(emptyCopy); setData(null); setError(""); setCopied(false); };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) { setError(inputType === "text" ? "Paste a job description first." : "Enter a public job URL first."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputType, content }) });
      const payload = await response.json() as ApiResult | ApiError;
      if (!response.ok) {
        const apiError = payload as ApiError;
        throw new Error(apiError.error ?? "Extraction failed.");
      }
      setData(payload as ApiResult); setCopied(false);
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Extraction failed. Please try again."); }
    finally { setLoading(false); }
  }

  async function copyJson() {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data.result, null, 2));
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main>
      <SiteHeader active="extractor" />
      <div className="page-shell">
        <section className="intro">
          <h1>Turn any job post into a clear checklist.</h1>
          <p>Paste a job description or link to a public job post and get a structured breakdown you can scan, save, and use.</p>
        </section>
        <form className="extract-form" onSubmit={submit} noValidate>
          <div className="mode-switch" role="tablist" aria-label="Input type">
            <button type="button" role="tab" aria-selected={inputType === "text"} onClick={() => setMode("text")}><List size={17} />Text</button>
            <button type="button" role="tab" aria-selected={inputType === "url"} onClick={() => setMode("url")}><Link2 size={17} />URL</button>
          </div>
          {inputType === "text" ? (
            <textarea aria-label="Job description" value={content} maxLength={50_000} onChange={(e) => setInputs((current) => ({ ...current, text: e.target.value }))} placeholder={"Paste the full job description here…\n\nInclude responsibilities, required skills, preferred skills, qualifications, and any other details."} />
          ) : (
            <div className="url-field"><Link2 size={18} /><input aria-label="Public job URL" type="url" value={content} maxLength={2_048} onChange={(e) => setInputs((current) => ({ ...current, url: e.target.value }))} placeholder="https://company.com/jobs/frontend-engineer" /></div>
          )}
          {error ? <div className="error" role="alert">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={19} />Extracting requirements…</> : <><Sparkles size={19} />Extract requirements</>}</button>
          <p className="privacy"><LockKeyhole size={15} />Your data stays private. We don’t store or share your input.</p>
        </form>

        {data ? <div className="results" id="results">
          <div className="result-toolbar">
            <div className="result-status"><Check size={18} /><strong>Extraction complete</strong><span aria-hidden="true">·</span><span>Source: {data.source.type === "text" ? "Pasted text" : <a href={data.source.url ?? undefined} target="_blank" rel="noreferrer">Job URL</a>}</span></div>
            <div className="result-actions"><button type="button" onClick={copyJson}><Clipboard size={16} />{copied ? "Copied" : "Copy JSON"}</button><button type="button" onClick={clear}><RotateCcw size={16} />Clear</button></div>
          </div>
          <ResultRow title="Job Overview"><p className="summary"><Value>{data.result.summary}</Value></p><dl className="overview-grid"><div><dt>Title</dt><dd><Value>{data.result.title}</Value></dd></div><div><dt>Company</dt><dd><Value>{data.result.company}</Value></dd></div><div><dt>Location</dt><dd><Value>{data.result.location}</Value></dd></div><div><dt>Work setup</dt><dd><Value>{data.result.remoteMode}</Value></dd></div><div><dt>Employment</dt><dd><Value>{data.result.employmentType}</Value></dd></div></dl></ResultRow>
          <ResultRow title="Required Skills"><Tags values={data.result.requiredSkills} /></ResultRow>
          <ResultRow title="Preferred Skills"><Tags values={data.result.preferredSkills} /></ResultRow>
          <ResultRow title="Experience & Education"><dl className="paired"><div><dt>Minimum experience</dt><dd><Value>{data.result.minimumExperience}</Value></dd></div><div><dt>Education</dt><dd><Value>{data.result.education}</Value></dd></div></dl></ResultRow>
          <ResultRow title="Responsibilities">{data.result.responsibilities.length ? <ul>{data.result.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul> : <span className="muted-value">None stated</span>}</ResultRow>
          <ResultRow title="Compensation & Deadline"><dl className="paired"><div><dt>Salary</dt><dd><Value>{data.result.salary}</Value></dd></div><div><dt>Application deadline</dt><dd><Value>{data.result.applicationDeadline}</Value></dd></div></dl></ResultRow>
          <details className="raw-json"><summary><Code2 size={17} />Raw JSON</summary><pre>{JSON.stringify(data.result, null, 2)}</pre></details>
          <p className="disclaimer">Results are AI-generated. Always review them for accuracy.</p>
        </div> : null}
      </div>
    </main>
  );
}
