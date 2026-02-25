const { marked } = require('marked');

marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
});

const AI_ENGINES = [
    'gemma-openrouter-free', 'gemma-openrouter-paid',
    'mistral-openrouter-free', 'mistral-openrouter-paid',
    'openrouter-custom', 'gemini-flash', 'gemini-custom'
];

const isAiEngine = (engine) => AI_ENGINES.includes(engine);

const escapeHtml = (text) => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const PDF_STYLES = `
  body {
    margin: 0; padding: 40px;
    font-family: 'Noto Sans Bengali', 'Noto Sans', 'Noto Serif', Georgia, serif;
    font-size: 14px; line-height: 1.8; color: #000; background: #fff;
  }
  h1 { font-size: 22px; margin: 24px 0 12px; border-bottom: 2px solid #333; padding-bottom: 6px; }
  h2.filename { font-size: 16px; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
  h2:not(.filename) { font-size: 18px; margin: 20px 0 10px; }
  h3 { font-size: 16px; margin: 16px 0 8px; }
  p { margin: 8px 0; text-align: justify; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; font-size: 13px; }
  th { background: #f0f0f0; font-weight: bold; }
  ul, ol { margin: 8px 0 8px 24px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px dashed #999; margin: 20px 0; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 12px; line-height: 1.6; }
  blockquote { border-left: 3px solid #ccc; margin: 8px 0; padding: 4px 12px; color: #555; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  .page-break { page-break-after: always; }
  .section { margin-bottom: 24px; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    .page-break { page-break-after: always; }
  }
`;

/**
 * Convert OCR results to a complete styled HTML document for PDF generation.
 * @param {Array<{filename: string, text: string}>} results
 * @param {object} options - { engine, outputFormat, lang }
 * @returns {string} Complete HTML document string
 */
const buildPdfHtml = (results, options = {}) => {
    const { engine = 'tesseract', outputFormat = 'plain' } = options;
    const useMarkdown = isAiEngine(engine) && outputFormat === 'markdown';

    const sections = results
        .filter(r => r.filename && r.text)
        .map(r => {
            const name = escapeHtml(r.filename);
            let content;

            if (useMarkdown) {
                let md = r.text;
                md = md.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```\s*$/i, '');
                md = md.replace(/---\s*Column\s*Break\s*---/gi, '\n---\n');

                // Protect math expressions from marked processing
                const mathPlaceholders = [];
                // Block math $$...$$
                md = md.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
                    mathPlaceholders.push(match);
                    return `%%MATH_${mathPlaceholders.length - 1}%%`;
                });
                // Inline math $...$
                md = md.replace(/\$([^\$\n]+?)\$/g, (match) => {
                    mathPlaceholders.push(match);
                    return `%%MATH_${mathPlaceholders.length - 1}%%`;
                });

                content = marked.parse(md);

                // Restore math expressions
                mathPlaceholders.forEach((expr, i) => {
                    content = content.replace(`%%MATH_${i}%%`, expr);
                });
            } else {
                content = `<pre>${escapeHtml(r.text)}</pre>`;
            }

            return `<div class="section"><h2 class="filename">${name}</h2>${content}</div>`;
        })
        .join('\n<div class="page-break"></div>\n');

    const katexCdn = useMarkdown ? `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false});"></script>` : '';

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><title>OCR Results</title>
<style>${PDF_STYLES}</style>${katexCdn}
<script>
  var printDelay = ${useMarkdown ? 800 : 300};
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() { setTimeout(function() { window.print(); }, printDelay); });
  } else {
    window.addEventListener('load', function() { setTimeout(function() { window.print(); }, printDelay); });
  }
</script>
</head><body>
<div class="no-print" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
  <p style="margin:0 0 8px;font-size:15px;color:#0369a1;"><strong>Save as PDF:</strong> Select "Save as PDF" as the destination in the print dialog.</p>
  <button onclick="window.print()" style="padding:10px 24px;background:#111827;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
</div>
${sections}
</body></html>`;
};

module.exports = { buildPdfHtml, isAiEngine, escapeHtml };
