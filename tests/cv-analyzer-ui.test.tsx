// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CvAnalyzer } from "@/components/cv-analyzer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CV analyzer UI", () => {
  it("validates missing files and conditionally shows the target job input", () => {
    render(<CvAnalyzer />);
    expect(screen.getByLabelText("Target job description")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /^Job requirements match/ }));
    expect(screen.queryByLabelText("Target job description")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analyze my CV" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Upload a PDF or DOCX CV first.");
  });

  it("submits selected options and renders the local analysis", async () => {
    const result = {
      overallScore: 84,
      summary: "Strong and relevant CV.",
      criteria: [{ guideline: "skills", score: 84, rationale: "Good coverage.", evidence: ["React"], gaps: [], recommendations: ["Add TypeScript depth."] }],
      strengths: ["Relevant skills"],
      priorityActions: ["Add metrics"],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result, fileName: "cv.pdf" }), {
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CvAnalyzer />);

    for (const name of [/^Job requirements match/, /^Experience/, /^Clarity and impact/, /^ATS readiness/]) {
      fireEvent.click(screen.getByRole("checkbox", { name }));
    }
    const file = new File(["%PDF-example"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/^Choose a CV file/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze my CV" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Strong and relevant CV.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Your CV scored/ })).toHaveTextContent("84/100");
    const request = fetchMock.mock.calls[0]?.[1] as { body: FormData };
    expect(JSON.parse(String(request.body.get("guidelines")))).toEqual(["skills"]);
  });

  it.each([
    ["an HTML error page", new Response("<!DOCTYPE html><title>Server error</title>", { status: 500, headers: { "Content-Type": "text/html" } })],
    ["malformed JSON", new Response("{broken", { status: 500, headers: { "Content-Type": "application/json" } })],
  ])("shows a safe message for %s", async (_case, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    render(<CvAnalyzer />);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Job requirements match/ }));
    const file = new File(["%PDF-example"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/^Choose a CV file/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze my CV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The CV analysis server returned an unexpected response. Please try again.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Unexpected token");
  });
});
