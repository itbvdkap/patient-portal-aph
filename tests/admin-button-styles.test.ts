// @vitest-environment node
import { readFileSync } from "node:fs";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { expect, it } from "vitest";
import config from "../tailwind.config";

it("generates a real contrasting background for every staff/password save button", async () => {
  const sources = ["src/app/admin/staff/staff-editor.tsx", "src/app/admin/password/password-form.tsx"].map(file => readFileSync(file, "utf8"));
  const result = await postcss([tailwindcss({ ...config, content: sources.map(raw => ({ raw, extension: "tsx" })) })]).process("@tailwind utilities;", { from: undefined });
  const backgrounds = new Map<string, string>();
  result.root.walkRules(rule => {
    rule.walkDecls("background-color", declaration => { backgrounds.set(rule.selector, declaration.value); });
  });
  const buttons = sources.flatMap(source => [...source.matchAll(/<button\b[^>]*type="submit"[^>]*className="([^"]+)"/g)].map(match => match[1]));
  expect(buttons).toHaveLength(3);
  for (const classes of buttons) {
    const background = classes.split(/\s+/).find(name => name.startsWith("bg-"));
    expect(background).toBe("bg-primary-700");
    expect(backgrounds.get(`.${background}`)).toContain("0 91 85");
    expect(classes.split(/\s+/)).toContain("text-white");
    expect(classes.split(/\s+/)).toContain("border-primary-700");
  }
});
