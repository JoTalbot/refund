import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const IGNORE = new Set([".git", "node_modules", "dist", "coverage"]);

export function collectMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (IGNORE.has(entry)) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".md")) {
        files.push(full);
      }
    }
  };
  walk(root);
  return files;
}

export function extractMarkdownLinks(markdown: string): string[] {
  const links = new Set<string>();
  const inline = /\[(?:[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const bare = /(?<![([])https:\/\/[^\s)<>"]+/g;
  let match: RegExpExecArray | null;
  while ((match = inline.exec(markdown))) {
    const href = match[1];
    if (href) links.add(href.replace(/[.,;]+$/, ""));
  }
  while ((match = bare.exec(markdown))) {
    links.add(match[0].replace(/[.,;]+$/, ""));
  }
  return [...links];
}
