"use client";

import React, { useState, useCallback, useRef } from "react";
import { PYTHON_COMPLETIONS } from "./PythonCompletions";

interface StrategyEditorProps {
  initialCode?: string;
  previousCode?: string; // For diff view
  onRunBacktest?: (code: string) => void;
  onSave?: (code: string) => void;
  readOnly?: boolean;
  height?: string;
}

/**
 * Strategy code editor with Python syntax highlighting,
 * VectorBT autocomplete, "Run Backtest" button, and optional diff view.
 *
 * Uses a textarea with syntax highlighting overlay for simplicity.
 * Monaco Editor can be swapped in when @monaco-editor/react is installed.
 */
export default function StrategyEditor({
  initialCode = "",
  previousCode,
  onRunBacktest,
  onSave,
  readOnly = false,
  height = "400px",
}: StrategyEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [showDiff, setShowDiff] = useState(false);
  const [showCompletions, setShowCompletions] = useState(false);
  const [completionFilter, setCompletionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setCode(value);

      // Simple autocomplete trigger
      const cursorPos = e.target.selectionStart;
      const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
      const currentWord = value.substring(lineStart, cursorPos).split(/\s/).pop() || "";

      if (currentWord.length >= 2) {
        setCompletionFilter(currentWord.toLowerCase());
        setShowCompletions(true);
      } else {
        setShowCompletions(false);
      }
    },
    []
  );

  const insertCompletion = useCallback(
    (insertText: string) => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;
      const lineStart = code.lastIndexOf("\n", cursorPos - 1) + 1;
      const currentLine = code.substring(lineStart, cursorPos);
      const lastSpace = currentLine.lastIndexOf(" ");
      const replaceStart = lineStart + lastSpace + 1;

      const newCode = code.substring(0, replaceStart) + insertText + code.substring(cursorPos);
      setCode(newCode);
      setShowCompletions(false);

      // Restore cursor
      setTimeout(() => {
        const newPos = replaceStart + insertText.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    },
    [code]
  );

  const filteredCompletions = PYTHON_COMPLETIONS.filter(
    (c) =>
      c.label.toLowerCase().includes(completionFilter) ||
      c.detail.toLowerCase().includes(completionFilter)
  ).slice(0, 8);

  const diffLines = showDiff && previousCode ? computeDiff(previousCode, code) : null;

  return (
    <div className="flex flex-col" style={{ height }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{
          borderColor: "var(--border-secondary)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Strategy Editor
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: "var(--accent-bg)",
            color: "var(--accent)",
          }}
        >
          Python
        </span>
        <div className="flex-1" />
        {previousCode && (
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: showDiff ? "var(--accent-bg)" : "transparent",
              color: showDiff ? "var(--accent)" : "var(--text-secondary)",
              border: "1px solid var(--border-secondary)",
            }}
          >
            {showDiff ? "Code" : "Diff"}
          </button>
        )}
        {onSave && (
          <button
            onClick={() => onSave(code)}
            className="text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-secondary)",
            }}
          >
            Save
          </button>
        )}
        {onRunBacktest && (
          <button
            onClick={() => onRunBacktest(code)}
            className="text-xs px-3 py-1 rounded font-medium"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--bg-primary)",
            }}
          >
            Run Backtest
          </button>
        )}
      </div>

      {/* Editor Area */}
      <div className="relative flex-1 overflow-hidden">
        {showDiff && diffLines ? (
          <div
            className="h-full overflow-auto p-3 font-mono text-xs"
            style={{ backgroundColor: "var(--bg-primary)" }}
          >
            {diffLines.map((line, i) => (
              <div
                key={i}
                className="whitespace-pre"
                style={{
                  color:
                    line.type === "add"
                      ? "#22c55e"
                      : line.type === "remove"
                      ? "#ef4444"
                      : "var(--text-secondary)",
                  backgroundColor:
                    line.type === "add"
                      ? "rgba(34,197,94,0.1)"
                      : line.type === "remove"
                      ? "rgba(239,68,68,0.1)"
                      : "transparent",
                }}
              >
                {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
                {line.text}
              </div>
            ))}
          </div>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={handleChange}
              readOnly={readOnly}
              spellCheck={false}
              className="w-full h-full resize-none p-3 font-mono text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                tabSize: 4,
              }}
              onKeyDown={(e) => {
                // Tab inserts 4 spaces
                if (e.key === "Tab") {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  const newCode = code.substring(0, start) + "    " + code.substring(end);
                  setCode(newCode);
                  setTimeout(() => {
                    e.currentTarget.setSelectionRange(start + 4, start + 4);
                  }, 0);
                }
                // Escape closes completions
                if (e.key === "Escape") {
                  setShowCompletions(false);
                }
              }}
            />

            {/* Autocomplete dropdown */}
            {showCompletions && filteredCompletions.length > 0 && (
              <div
                className="absolute z-50 w-80 max-h-48 overflow-auto rounded shadow-lg border"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border-secondary)",
                  bottom: "40px",
                  left: "16px",
                }}
              >
                {filteredCompletions.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => insertCompletion(item.insertText)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 flex items-center gap-2"
                    style={{
                      backgroundColor: "transparent",
                      color: "var(--text-primary)",
                    }}
                  >
                    <span
                      className="px-1 rounded text-[10px] font-mono"
                      style={{
                        backgroundColor: "var(--accent-bg)",
                        color: "var(--accent)",
                      }}
                    >
                      {item.kind}
                    </span>
                    <span className="font-mono">{item.label}</span>
                    <span
                      className="ml-auto truncate"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {item.detail}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center px-3 py-1 text-[10px] border-t"
        style={{
          borderColor: "var(--border-secondary)",
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-tertiary)",
        }}
      >
        <span>{code.split("\n").length} lines</span>
        <span className="mx-2">|</span>
        <span>{code.length} chars</span>
        {readOnly && (
          <>
            <span className="mx-2">|</span>
            <span>Read Only</span>
          </>
        )}
      </div>
    </div>
  );
}

// Simple line-by-line diff computation
interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
}

function computeDiff(oldCode: string, newCode: string): DiffLine[] {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  const result: DiffLine[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      result.push({ type: "add", text: newLine });
    } else if (newLine === undefined) {
      result.push({ type: "remove", text: oldLine });
    } else if (oldLine === newLine) {
      result.push({ type: "same", text: newLine });
    } else {
      result.push({ type: "remove", text: oldLine });
      result.push({ type: "add", text: newLine });
    }
  }

  return result;
}
