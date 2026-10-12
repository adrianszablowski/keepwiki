import { describe, expect, it } from 'vitest';
import { pickCaptionTrack, videoId, videoMetaFromPage, videoNoteBody, vttToText } from './youtube.js';

describe('recognising a YouTube video', () => {
	it('reads the id from watch, short and shorts urls, ignoring other parameters', () => {
		expect(videoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
		expect(videoId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
		expect(videoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(videoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(videoId('https://www.youtube.com/live/dQw4w9WgXcQ?feature=share')).toBe('dQw4w9WgXcQ');
		expect(videoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('returns undefined for anything else', () => {
		expect(videoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeUndefined();
		expect(videoId('not a url')).toBeUndefined();
	});
});

describe('turning captions into text', () => {
	it('drops the header, timings and tags and merges the repeated lines of automatic captions', () => {
		const vtt = [
			'WEBVTT',
			'Kind: captions',
			'Language: en',
			'',
			'00:00:00.000 --> 00:00:02.000 align:start position:0%',
			'hydration is the<00:00:01.000><c> weight</c>',
			'',
			'00:00:02.000 --> 00:00:04.000',
			'hydration is the weight',
			'of water',
			'',
			'00:00:04.000 --> 00:00:06.000',
			'of water',
			'divided by flour',
			'',
		].join('\n');

		expect(vttToText(vtt)).toBe('hydration is the weight\nof water\ndivided by flour');
	});
});

describe('choosing a caption track from yt-dlp metadata', () => {
	const info = {
		subtitles: { pl: [{ ext: 'vtt', url: 'https://c/pl.vtt' }] },
		automatic_captions: {
			en: [
				{ ext: 'json3', url: 'https://c/en.json3' },
				{ ext: 'vtt', url: 'https://c/en-auto.vtt' },
			],
			de: [{ ext: 'vtt', url: 'https://c/de-auto.vtt' }],
		},
	};

	it('prefers a manual track in the wanted language', () => {
		expect(pickCaptionTrack(info, 'pl')).toEqual({ language: 'pl', url: 'https://c/pl.vtt', isAutomatic: false });
	});

	it('falls back to automatic captions in the wanted language, then english, then anything', () => {
		expect(pickCaptionTrack(info, 'en')).toEqual({ language: 'en', url: 'https://c/en-auto.vtt', isAutomatic: true });
		expect(pickCaptionTrack({ automatic_captions: { de: info.automatic_captions.de } }, 'fr')).toEqual({
			language: 'de',
			url: 'https://c/de-auto.vtt',
			isAutomatic: true,
		});
	});

	it('returns undefined when there is no vtt track at all', () => {
		expect(pickCaptionTrack({ subtitles: {}, automatic_captions: {} }, 'en')).toBeUndefined();
	});
});

describe('reading the title, author and description without yt-dlp', () => {
	it('takes title and author from oembed and the description from the page meta tag', () => {
		const meta = videoMetaFromPage(
			{ title: 'Sourdough hydration &amp; you', author_name: 'Baker' },
			'<html><head><meta name="description" content="Water to flour, explained &quot;simply&quot;."></head></html>',
		);

		expect(meta).toEqual({
			title: 'Sourdough hydration & you',
			author: 'Baker',
			description: 'Water to flour, explained "simply".',
		});
	});

	it('leaves the description empty when the page has none', () => {
		expect(videoMetaFromPage({ title: 'T', author_name: 'A' }, '<html></html>').description).toBe('');
	});
});

describe('composing the note body of a video', () => {
	const video = { title: 'T', author: 'A', description: 'About the talk.', transcript: 'spoken words' };

	it('puts the description first and the transcript under its own heading', () => {
		expect(videoNoteBody(video)).toBe('About the talk.\n\n## Transcript\n\nspoken words');
	});

	it('is undefined when the transcript is missing or blank, so the skill asks for a paste', () => {
		expect(videoNoteBody({ ...video, transcript: undefined })).toBeUndefined();
		expect(videoNoteBody({ ...video, transcript: '  \n' })).toBeUndefined();
	});
});
