"use client";

import React, { useState } from "react";
import { Check, FileText, Link2, LoaderCircle, LockKeyhole, RotateCcw, Sparkles, Upload } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import {
  cvGuidelineIds,
  cvGuidelineLabels,
  type CvAnalysis,
  type CvGuideline,
} from "@/lib/schema";

type JobInputType = "text" | "url";
type ApiResponse = { result: CvAnalysis; fileName: string };
type ApiError = { error?: string };

const unexpectedResponseError = "The CV analysis server returned an unexpected response. Please try again.";

const defaultGuidelines: CvGuideline[] = ["jobMatch", "skills", "experience", "clarity", "atsReadiness"];
const guidelineDescriptions: Record<CvGuideline, string> = {
  jobMatch: "Compare the CV with a specific job post.",
  skills: "Assess the relevance and presentation of skills.",
  experience: "Review experience, scope, and measurable impact.",
  education: "Review education and relevant qualifications.",
  clarity: "Assess structure, readability, and persuasive writing.",
  atsReadiness: "Check scanability, keywords, and standard sections.",
};

function Score({ value }: { value: number }) {
  return <span className="score-pill" aria-label={`${value} out of 100`}>{value}</span>;
}

function ListBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="analysis-list">
      <h4>{title}</h4>
      {values.length ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p className="muted-value">None identified</p>}
    </div>
  );
}

async function readApiPayload(response: Response): Promise<ApiResponse | ApiError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) return { error: unexpectedResponseError };
  try {
    return await response.json() as ApiResponse | ApiError;
  } catch {
    return { error: unexpectedResponseError };
  }
}

export function CvAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [guidelines, setGuidelines] = useState<CvGuideline[]>(defaultGuidelines);
  const [jobInputType, setJobInputType] = useState<JobInputType>("text");
  const [jobInputs, setJobInputs] = useState({ text: "", url: "" });
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const needsJob = guidelines.includes("jobMatch");
  const jobContent = jobInputs[jobInputType];

  function toggleGuideline(id: CvGuideline) {
    setGuidelines((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setError("");
  }

  function reset() {
    setFile(null);
    setGuidelines(defaultGuidelines);
    setJobInputType("text");
    setJobInputs({ text: "", url: "" });
    setData(null);
    setError("");
    const input = document.getElementById("cv-file") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) { setError("Upload a PDF or DOCX CV first."); return; }
    if (!guidelines.length) { setError("Select at least one analysis guideline."); return; }
    if (needsJob && !jobContent.trim()) { setError(jobInputType === "text" ? "Paste a job description for job matching." : "Enter a public job URL for job matching."); return; }

    setLoading(true);
    setError("");
    const body = new FormData();
    body.set("cv", file);
    body.set("guidelines", JSON.stringify(guidelines));
    body.set("jobInputType", needsJob ? jobInputType : "");
    body.set("jobContent", needsJob ? jobContent : "");
    try {
      const response = await fetch("/api/analyze-cv", { method: "POST", body });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error((payload as ApiError).error ?? "CV analysis failed.");
      setData(payload as ApiResponse);
      requestAnimationFrame(() => document.getElementById("cv-results")?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CV analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <SiteHeader active="cv" />
      <div className="page-shell">
        <section className="intro">
          <h1>See how your CV holds up.</h1>
          <p>Choose what matters, add a job post when needed, and get a private CV review from your local Ollama model.</p>
        </section>

        <form className="cv-form" onSubmit={submit} noValidate>
          <section className="form-section">
            <div className="section-heading"><span>1</span><div><h2>Upload your CV</h2><p>PDF or DOCX, up to 5 MB. Text-based files work best.</p></div></div>
            <label className={`file-drop ${file ? "file-drop--selected" : ""}`} htmlFor="cv-file">
              {file ? <><FileText size={28} /><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · Choose another file</span></> : <><Upload size={28} /><strong>Choose a CV file</strong><span>PDF or DOCX, up to 5 MB</span></>}
              <input id="cv-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setData(null); setError(""); }} />
            </label>
          </section>

          <section className="form-section">
            <div className="section-heading"><span>2</span><div><h2>Choose analysis guidelines</h2><p>Select one or more areas for the local model to assess.</p></div></div>
            <fieldset className="guideline-grid">
              <legend className="sr-only">Analysis guidelines</legend>
              {cvGuidelineIds.map((id) => (
                <label key={id} className={guidelines.includes(id) ? "guideline-card guideline-card--selected" : "guideline-card"}>
                  <input type="checkbox" checked={guidelines.includes(id)} onChange={() => toggleGuideline(id)} />
                  <span><strong>{cvGuidelineLabels[id]}</strong><small>{guidelineDescriptions[id]}</small></span>
                </label>
              ))}
            </fieldset>
          </section>

          {needsJob ? <section className="form-section">
            <div className="section-heading"><span>3</span><div><h2>Add the target job</h2><p>Required because job requirements match is selected.</p></div></div>
            <div className="mode-switch" role="tablist" aria-label="Job input type">
              <button type="button" role="tab" aria-selected={jobInputType === "text"} onClick={() => { setJobInputType("text"); setError(""); }}><FileText size={17} />Text</button>
              <button type="button" role="tab" aria-selected={jobInputType === "url"} onClick={() => { setJobInputType("url"); setError(""); }}><Link2 size={17} />URL</button>
            </div>
            {jobInputType === "text" ? <textarea aria-label="Target job description" value={jobContent} maxLength={50_000} onChange={(event) => setJobInputs((current) => ({ ...current, text: event.target.value }))} placeholder="Paste the target job description here…" /> : <div className="url-field"><Link2 size={18} /><input aria-label="Public target job URL" type="url" value={jobContent} maxLength={2_048} onChange={(event) => setJobInputs((current) => ({ ...current, url: event.target.value }))} placeholder="https://company.com/jobs/role" /></div>}
          </section> : null}

          {error ? <div className="error" role="alert">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={19} />Analyzing locally…</> : <><Sparkles size={19} />Analyze my CV</>}</button>
          <p className="privacy"><LockKeyhole size={15} />Your CV is processed by your local Ollama model and is not stored by this app.</p>
        </form>

        {data ? <section className="cv-results" id="cv-results" aria-labelledby="analysis-title">
          <div className="analysis-hero">
            <div><p><Check size={17} /> Local analysis complete</p><h2 id="analysis-title">Your CV scored <strong>{data.result.overallScore}</strong>/100</h2><span>{data.fileName}</span></div>
            <Score value={data.result.overallScore} />
          </div>
          <p className="analysis-summary">{data.result.summary}</p>
          <div className="criteria-results">
            {data.result.criteria.map((criterion) => <article className="criterion-card" key={criterion.guideline}>
              <header><h3>{cvGuidelineLabels[criterion.guideline]}</h3><Score value={criterion.score} /></header>
              <p>{criterion.rationale}</p>
              <div className="criterion-details"><ListBlock title="Evidence" values={criterion.evidence} /><ListBlock title="Gaps" values={criterion.gaps} /><ListBlock title="Recommendations" values={criterion.recommendations} /></div>
            </article>)}
          </div>
          <div className="analysis-bottom"><ListBlock title="Key strengths" values={data.result.strengths} /><ListBlock title="Priority actions" values={data.result.priorityActions} /></div>
          <button className="secondary-button" type="button" onClick={reset}><RotateCcw size={16} />Analyze another CV</button>
          <p className="disclaimer">This AI-generated review is advisory. Check the suggestions before changing your CV.</p>
        </section> : null}
      </div>
    </main>
  );
}
