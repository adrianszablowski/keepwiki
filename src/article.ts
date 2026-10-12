import { decodeEntities } from './html.js';

export interface Article {
	readonly title: string;
	readonly text: string;
}

export async function fetchArticle(url: string): Promise<Article> {
	const response = await fetch(url, {
		headers: { 'user-agent': 'keepwiki' },
		redirect: 'follow',
		signal: AbortSignal.timeout(fetchTimeoutMs),
	});

	if (!response.ok) {
		throw new Error(`${url} answered ${response.status}.`);
	}

	const article = extractArticle(await response.text());

	return { ...article, title: article.title === '' ? url : article.title };
}

export function extractArticle(html: string): Article {
	const page = html.replace(commentPattern, '').replace(noisePattern, '');
	const title = decodeEntities(innerText(page.match(titlePattern)?.[1] ?? page.match(headingPattern)?.[1] ?? ''));
	const region =
		page.match(articlePattern)?.[1] ?? page.match(mainPattern)?.[1] ?? page.match(bodyPattern)?.[1] ?? page;

	return { title, text: decodeEntities(innerText(blocksToLines(region))) };
}

function blocksToLines(html: string): string {
	return html
		.replace(/<li\b[^>]*>/gi, '\n- ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|h[1-6]|ul|ol|blockquote|pre|section|article|header|table)>/gi, '\n\n')
		.replace(/<(p|div|h[1-6]|ul|ol|blockquote|pre|section|table|tr)\b[^>]*>/gi, '\n')
		.replace(/<\/(li|tr)>/gi, '');
}

function innerText(html: string): string {
	return html
		.replace(/<[^>]+>/g, '')
		.split('\n')
		.map((line) => line.replace(/[ \t\r]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

const fetchTimeoutMs = 20_000;
const commentPattern = /<!--[\s\S]*?-->/g;
const noisePattern = /<(script|style|noscript|nav|footer|aside|svg|form)\b[\s\S]*?<\/\1>/gi;
const titlePattern = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
const headingPattern = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;
const articlePattern = /<article\b[^>]*>([\s\S]*?)<\/article>/i;
const mainPattern = /<main\b[^>]*>([\s\S]*?)<\/main>/i;
const bodyPattern = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
