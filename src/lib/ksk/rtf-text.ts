// Read only the visible text of legacy HIS RichEdit results. Never interpret RTF as HTML.
// A null result means the document cannot be converted reliably and needs HIS review.
const hiddenDestinations = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "generator",
  "header", "footer", "headerl", "headerr", "footerl", "footerr", "footnote",
  "annotation", "fldinst", "xmlopen", "xmlclose", "datastore", "themedata",
]);

interface GroupState { hidden: boolean; starred: boolean; unicodeSkip: number; codePage: string }

function skipFallback(source: string, start: number, count: number) {
  let index = start;
  while (count > 0 && index < source.length && source[index] !== "{" && source[index] !== "}") {
    if (source[index] === "\\") {
      if (source[index + 1] === "'" && /^[0-9a-f]{2}$/i.test(source.slice(index + 2, index + 4))) { index += 4; count--; continue; }
      if ("\\{}~_-".includes(source[index + 1] || "")) { index += 2; count--; continue; }
      // Formatting controls do not count as fallback characters.
      const control = /^\\[a-zA-Z]+-?\d* ?/.exec(source.slice(index));
      if (control) { index += control[0].length; continue; }
    }
    index++; count--;
  }
  return index;
}

export function rtfToPlainText(source: string): string | null {
  const input = source.trim();
  if (!/^\{\\rtf\d/.test(input)) return null;
  const states: GroupState[] = [];
  const output: string[] = [];
  let bytes: number[] = [], failed = false;
  const current = () => states[states.length - 1];
  const flushBytes = () => {
    if (!bytes.length) return;
    try { if (!current()?.hidden) output.push(new TextDecoder(current()?.codePage || "windows-1252", { fatal: true }).decode(Uint8Array.from(bytes))); }
    catch { failed = true; }
    bytes = [];
  };
  for (let index = 0; index < input.length;) {
    const char = input[index];
    if (char === "{") {
      flushBytes();
      const parent = current();
      states.push({ hidden: parent?.hidden ?? false, starred: false, unicodeSkip: parent?.unicodeSkip ?? 1, codePage: parent?.codePage ?? "windows-1252" });
      index++; continue;
    }
    if (char === "}") {
      flushBytes();
      if (!states.length) return null;
      states.pop(); index++; continue;
    }
    if (!states.length) { if (!/\s/.test(char)) return null; index++; continue; }
    if (char === "\\") {
      flushBytes(); index++;
      if (index >= input.length) return null;
      const symbol = input[index];
      if (symbol === "'" && /^[0-9a-f]{2}$/i.test(input.slice(index + 1, index + 3))) {
        if (!current().hidden) bytes.push(parseInt(input.slice(index + 1, index + 3), 16));
        index += 3;
        // Consecutive escaped bytes may be a multibyte code-page sequence.
        while (input.slice(index, index + 2) === "\\'" && /^[0-9a-f]{2}$/i.test(input.slice(index + 2, index + 4))) {
          if (!current().hidden) bytes.push(parseInt(input.slice(index + 2, index + 4), 16));
          index += 4;
        }
        flushBytes(); continue;
      }
      if (!/[a-zA-Z]/.test(symbol)) {
        if (symbol === "*") current().starred = true;
        else if (!current().hidden) {
          if ("\\{}".includes(symbol)) output.push(symbol);
          else if (symbol === "~") output.push("\u00a0");
          else if (symbol === "_") output.push("‑");
        }
        index++; continue;
      }
      const start = index;
      while (index < input.length && /[a-zA-Z]/.test(input[index])) index++;
      const word = input.slice(start, index).toLowerCase();
      const numberStart = index;
      if (input[index] === "-") index++;
      while (index < input.length && /\d/.test(input[index])) index++;
      const number = index > numberStart ? Number(input.slice(numberStart, index)) : null;
      if (input[index] === " ") index++;
      const state = current();
      if (state.starred || hiddenDestinations.has(word)) { state.hidden = true; state.starred = false; }
      if (word === "uc" && number !== null) state.unicodeSkip = Math.max(0, Math.min(32, number));
      if (word === "ansicpg" && number !== null) state.codePage = number === 65001 ? "utf-8" : `windows-${number}`;
      if (word === "bin" && number !== null) { if (number < 0 || index + number > input.length) return null; index += number; continue; }
      if (state.hidden) continue;
      if (word === "u" && number !== null) { output.push(String.fromCharCode(number & 0xffff)); index = skipFallback(input, index, state.unicodeSkip); }
      else if (["par", "line", "row", "page"].includes(word)) output.push("\n");
      else if (["tab", "cell"].includes(word)) output.push("\t");
      else if (word === "emdash") output.push("—");
      else if (word === "endash") output.push("–");
      else if (word === "bullet") output.push("•");
      else if (word === "lquote" || word === "rquote") output.push(word === "lquote" ? "‘" : "’");
      else if (word === "ldblquote" || word === "rdblquote") output.push(word === "ldblquote" ? "“" : "”");
      continue;
    }
    if (char !== "\r" && char !== "\n" && !current().hidden) { flushBytes(); output.push(char); }
    index++;
  }
  if (states.length || failed) return null;
  return output.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function plainClsResult(value: string | null | undefined) {
  if (!value?.trim()) return "Chưa có giá trị";
  if (!value.trim().startsWith("{\\rtf")) return value.trim();
  const converted = rtfToPlainText(value);
  return converted === null ? "Không chuyển được RTF — đối chiếu HIS" : converted || "Chưa có nội dung văn bản";
}
