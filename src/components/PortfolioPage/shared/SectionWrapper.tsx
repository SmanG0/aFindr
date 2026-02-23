"use client";

import React from "react";

interface SectionWrapperProps {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}

export default function SectionWrapper({ title, children, rightAction }: SectionWrapperProps) {
  return (
    <section style={{ marginBottom: 48 }}>
      <div
        className="flex items-center justify-between"
        style={{
          padding: "16px 0",
          borderBottom: "1px solid var(--glass-border)",
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {rightAction}
      </div>
      {children}
    </section>
  );
}
