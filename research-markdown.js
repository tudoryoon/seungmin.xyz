import { Marked } from './vendor/marked.mjs';
import createDOMPurify from './vendor/dompurify.mjs';
import { safeSourceURL } from './research-core.js';

const parser = new Marked({ breaks: true, gfm: true });
parser.use({ extensions: [
  { name: 'notionAttributes', level: 'inline', start: text => text.indexOf('{'),
    tokenizer(text) { const match = /^\{(?:(?:color="[a-z_]+"|toggle="true")\s*)+\}/.exec(text); if (match) return {type:'notionAttributes',raw:match[0]}; },
    renderer() { return ''; } },
  { name: 'notionStrong', level: 'inline', start: text => text.indexOf('**'),
    tokenizer(text) { const match = /^\*\*([^*]+?)\*\*/.exec(text); if (match) return {type:'notionStrong',raw:match[0],tokens:this.lexer.inlineTokens(match[1].trim())}; },
    renderer(token) { return '<strong>' + this.parser.parseInline(token.tokens) + '</strong>'; } }
] });

export function renderNotionMarkdown(markdown, document) {
  const fragment = createDOMPurify(document.defaultView).sanitize(parser.parse(markdown), {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ['p','br','strong','em','del','s','code','pre','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','a','img','table','thead','tbody','tr','td','th','hr','details','summary','page','mention-page','file','pdf','video','audio'],
    ALLOWED_ATTR: ['href','src','alt','title','colspan','rowspan','start','url'],
    ALLOW_DATA_ATTR: false
  });
  for (const page of fragment.querySelectorAll('page,mention-page,file,pdf,video,audio')) {
    const link = document.createElement('a'), url = safeSourceURL(page.getAttribute('url') || page.getAttribute('src'));
    link.textContent = page.textContent || '첨부 자료'; if (url) link.href = url; page.replaceWith(link);
  }
  for (const link of fragment.querySelectorAll('a')) {
    const url = safeSourceURL(link.getAttribute('href'));
    if (url) { link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else link.removeAttribute('href');
  }
  for (const image of fragment.querySelectorAll('img')) {
    const url = safeSourceURL(image.getAttribute('src'));
    if (!url) { image.remove(); continue; }
    image.src = url; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
  }
  return fragment;
}
