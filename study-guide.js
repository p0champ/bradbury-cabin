import { BUILTIN_GUIDES } from "./guide-data.js?v=52";

// Optional editorial material must never invalidate a readable pick.
export function normalizeGuide(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = {};
  for (const key of ["context", "notice", "themes", "questions"]) {
    const input = typeof value[key] === "string" ? [value[key]] : value[key];
    result[key] = Array.isArray(input)
      ? input.slice(0, 8).filter((s) => typeof s === "string")
          .map((s) => s.trim().slice(0, 1200)).filter(Boolean)
      : [];
  }
  return Object.values(result).some((a) => a.length) ? result : null;
}

export function studyGuide(work) {
  const guide = normalizeGuide(work.guide) || normalizeGuide(BUILTIN_GUIDES[work.id]);
  const blocks = [];
  const heading = (text, pageBreak = false) => blocks.push({ type: "heading", text, pageBreak });
  const paragraphs = (items, numbered = false) => items.forEach((text, i) =>
    blocks.push({ type: "para", text: numbered ? `${i + 1}. ${text}` : text }));
  if (!guide) paragraphs(["No study guide for this text."]);
  else {
    heading("Before reading");
    paragraphs(guide.context);
    if (!guide.context.length && !guide.notice.length)
      paragraphs(["No before-reading notes for this text."]);
    if (guide.notice.length) {
      heading("Things to notice");
      paragraphs(guide.notice, true);
    }
    // A deliberate page turn separates all interpretation from the introduction.
    if (guide.themes.length || guide.questions.length) {
      heading("After reading — spoilers", true);
      paragraphs(guide.themes);
      if (guide.questions.length) {
        heading("Questions to think about");
        paragraphs(guide.questions, true);
      }
    }
  }
  return {
    id: `guide:${work.id}`, kind: "guide", title: work.title,
    author: "Study guide", blocks,
  };
}
