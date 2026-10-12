import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { extractArticle, fetchArticle } from './article.js';

const page = `<!doctype html>
<html><head><title>Canonical tags &amp; you</title><style>p{}</style></head>
<body>
<nav><a href="/">Home</a></nav>
<article>
<h1>Canonical tags</h1>
<p>A canonical tag tells Google which URL is the <strong>main</strong> one.</p>
<ul><li>Use absolute URLs</li><li>One per page</li></ul>
<script>track()</script>
<p>It&#39;s optional &lt;but&gt; useful.</p>
</article>
<footer>Copyright</footer>
</body></html>`;

describe('turning a web page into text', () => {
	it('keeps the article text and drops navigation, scripts, styles and tags', () => {
		const { title, text } = extractArticle(page);

		expect(title).toBe('Canonical tags & you');
		expect(text).toBe(
			[
				'Canonical tags',
				'',
				'A canonical tag tells Google which URL is the main one.',
				'',
				'- Use absolute URLs',
				'- One per page',
				'',
				"It's optional <but> useful.",
			].join('\n'),
		);
	});

	it('falls back to main, then body, when there is no article element', () => {
		expect(extractArticle('<html><body><main><p>Main</p></main><p>Other</p></body></html>').text).toBe('Main');
		expect(extractArticle('<html><body><p>Only</p></body></html>').text).toBe('Only');
	});

	it('uses the first heading as the title when the page has no title element', () => {
		expect(extractArticle('<body><h1>Heading</h1><p>x</p></body>').title).toBe('Heading');
	});
});

describe('fetching an article', () => {
	it('returns the title and text of a page that answers 200', async () => {
		const server = createServer((_, response) => response.end(page)).listen(0);
		const { port } = server.address() as { port: number };

		try {
			const article = await fetchArticle(`http://127.0.0.1:${port}/a`);

			expect(article.title).toBe('Canonical tags & you');
			expect(article.text).toContain('A canonical tag tells Google');
		} finally {
			server.close();
		}
	});

	it('throws with the status when the page does not answer 200', async () => {
		const server = createServer((_, response) => response.writeHead(403).end()).listen(0);
		const { port } = server.address() as { port: number };

		try {
			await expect(fetchArticle(`http://127.0.0.1:${port}/a`)).rejects.toThrow(/403/);
		} finally {
			server.close();
		}
	});
});
