import { layoutWork } from "./reader.js?v=35";
import { studyGuide, normalizeGuide } from "./study-guide.js?v=35";
import { BUILTIN_GUIDES } from "./guide-data.js?v=35";

// One work, one sequence of pages. Keep source blocks/word anchors intact so
// adding notes never moves an existing saved place into a different text.
export function layoutReading(ctx, work, size, options) {
  const text = layoutWork(ctx, work, size, options);
  const guide = normalizeGuide(work.guide) || normalizeGuide(BUILTIN_GUIDES[work.id]);
  const sections = [];
  if (guide) {
    const notes = studyGuide(work);
    const split = notes.blocks.findIndex(b => b.pageBreak);
    const before = split < 0 ? notes.blocks : notes.blocks.slice(0, split);
    // This section already starts a fresh layout; its first heading must not
    // push the title/meta onto a separate, otherwise empty page.
    const after = split < 0 ? [] : notes.blocks.slice(split).map((block, i) =>
      i === 0 ? { ...block, pageBreak: false } : block);
    if (guide.context.length || guide.notice.length)
      sections.push(["before", layoutWork(ctx, { ...notes, blocks: before }, size, options)]);
    sections.push(["text", text]);
    if (after.length) sections.push(["after", layoutWork(ctx, { ...notes, blocks: after }, size, options)]);
  } else sections.push(["text", text]);
  return sections.flatMap(([section, pages]) => pages.map((page, i) => {
    page.section = section;
    page.sectionPage = i + 1;
    page.sectionPages = pages.length;
    page.anchor = { ...page.anchor, section };
    return page;
  }));
}
