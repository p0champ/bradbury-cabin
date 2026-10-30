// No reading text is sent: only a deliberately pinched word. Never invent a result.
const LOCAL = Object.freeze({
  thou: { meaning: 'An old word for “you”, used when speaking to one person.' },
  thy: { meaning: 'An old word for “your”.' },
  parsimony: { meaning: 'Being very unwilling to spend money; extreme thrift.' },
  imputation: { meaning: 'An accusation or suggestion that someone has done something wrong.' },
  instigates: { meaning: 'Starts or brings something about.' },
  predominating: { meaning: 'Being the most common or strongest part.' },
  magi: { meaning: 'Wise men or learned religious figures.', background: 'In the Christian Christmas story, the Magi bring gifts to the infant Jesus. O. Henry’s title draws on that tradition.', source: 'Matthew 2; The Gift of the Magi', url: 'https://en.wikipedia.org/wiki/Biblical_Magi' },
  olympus: { meaning: 'A mountain in Greece.', background: 'In ancient Greek myth, Mount Olympus is the home of the gods.', source: 'Wikipedia · Mount Olympus', url: 'https://en.wikipedia.org/wiki/Mount_Olympus' },
  troy: { meaning: 'An ancient city in what is now Turkey.', background: 'Greek stories place the Trojan War here; Homer’s Iliad tells part of that story.', source: 'Wikipedia · Troy', url: 'https://en.wikipedia.org/wiki/Troy' },
});
const clean = s => String(s || '').replace(/^[^\p{L}]+|[^\p{L}’'\-]+$/gu, '').slice(0, 80);
const short = (s, max = 300) => {
  const text = String(s || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
};
const cache = new Map();
async function json(url, signal) {
  const r = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw Error('Lookup unavailable');
  return r.json();
}
export async function lookupWord(raw, { signal } = {}) {
  const word = clean(raw), key = word.toLowerCase();
  if (!word) return { word, meaning: 'No word selected.' };
  if (LOCAL[key]) return { word, source: 'Cabin glossary', ...LOCAL[key] };
  if (cache.has(key)) return { ...cache.get(key), word };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 6000);
  try {
    const dictionary = await json(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, controller.signal).catch(() => null);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const definitions = dictionary?.flatMap?.(e => e.meanings || []).flatMap(m => m.definitions || []).map(d => d.definition).filter(Boolean) || [];
    let result = { word, meaning: definitions.length ? short(definitions[0]) : 'No clear dictionary meaning found.', source: definitions.length ? 'Wiktionary via Free Dictionary' : '', url: definitions.length ? `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}` : undefined };
    // A capitalised reference or a dictionary miss may be a place, myth or event.
    // Exact article title only: no fuzzy search that could invent a connection.
    if (/^\p{Lu}/u.test(word) || !definitions.length) {
      const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', prop: 'extracts|pageprops', explaintext: '1', exintro: '1', exsentences: '2', redirects: '1', titles: word });
      const wiki = await json(`https://en.wikipedia.org/w/api.php?${params}`, controller.signal).catch(() => null);
      const page = Object.values(wiki?.query?.pages || {})[0];
      if (/\b(city|town|village|country|mountain|river|island|myth|mythology|god|goddess|war|battle|revolution|empire|historical|ancient)\b/i.test(page?.extract || '') && page?.extract && page.missing === undefined && !Object.hasOwn(page.pageprops || {}, 'disambiguation')) {
        const note = short(page.extract);
        if (definitions.length) result.background = note;
        else {
          const sentences = typeof Intl.Segmenter === 'function'
            ? [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(page.extract)].map(s => s.segment.trim()).filter(Boolean)
            : [page.extract];
          result.meaning = short(sentences[0]);
          if (sentences.length > 1) result.background = short(sentences.slice(1).join(' '));
        }
        result.source = definitions.length ? 'Free Dictionary + Wikipedia · general reference' : 'Wikipedia · general reference';
        result.url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`;
      }
    }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!dictionary && !result.url) result = { word, meaning: 'Could not look this up. Check your connection. Pinch again to close, then retry.' };
    else { if (cache.size >= 160) cache.delete(cache.keys().next().value); cache.set(key, result); }
    return result;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
