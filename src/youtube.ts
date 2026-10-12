import { execFileSync } from 'node:child_process';
import { decodeEntities } from './html.js';

export const transcriptMissingOutcome = 'needs-transcript';

export interface VideoMeta {
	readonly title: string;
	readonly author: string;
	readonly description: string;
}

export interface Video extends VideoMeta {
	readonly transcript: string | undefined;
}

export interface CaptionTrack {
	readonly language: string;
	readonly url: string;
	readonly isAutomatic: boolean;
}

interface CaptionFormat {
	readonly ext: string;
	readonly url: string;
}

export interface CaptionInfo {
	readonly subtitles?: Readonly<Record<string, readonly CaptionFormat[]>>;
	readonly automatic_captions?: Readonly<Record<string, readonly CaptionFormat[]>>;
}

interface OembedResponse {
	readonly title: string;
	readonly author_name: string;
}

interface YtDlpInfo extends CaptionInfo {
	readonly title?: string;
	readonly uploader?: string;
	readonly channel?: string;
	readonly description?: string;
}

export function videoId(url: string): string | undefined {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.replace(/^(www|m)\./, '');

		if (host === 'youtu.be') {
			return idOrUndefined(parsed.pathname.slice(1));
		}

		if (host === 'youtube.com') {
			const inPath = parsed.pathname.match(/^\/(shorts|live|embed)\/([^/]+)/)?.[2];

			return idOrUndefined(inPath ?? parsed.searchParams.get('v') ?? '');
		}

		return undefined;
	} catch {
		return undefined;
	}
}

export function vttToText(vtt: string): string {
	const lines = vtt
		.split('\n')
		.filter((line) => !isCueMetadata(line))
		.map((line) => line.replace(/<[^>]+>/g, '').trim())
		.filter((line) => line !== '');

	return lines.filter((line, index) => line !== lines[index - 1]).join('\n');
}

export function pickCaptionTrack(info: CaptionInfo, language: string): CaptionTrack | undefined {
	const manual = tracks(info.subtitles ?? {}, false);
	const automatic = tracks(info.automatic_captions ?? {}, true);
	const wanted = [language, 'en'];

	return (
		wanted.map((code) => manual.find((track) => matchesLanguage(track, code))).find(Boolean) ??
		wanted.map((code) => automatic.find((track) => matchesLanguage(track, code))).find(Boolean) ??
		manual[0] ??
		automatic[0]
	);
}

export function videoNoteBody(video: Video): string | undefined {
	if (video.transcript === undefined || video.transcript.trim() === '') {
		return undefined;
	}

	return `${video.description}\n\n## Transcript\n\n${video.transcript}`;
}

export function videoMetaFromPage(oembed: OembedResponse, html: string): VideoMeta {
	const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '';

	return {
		title: decodeEntities(oembed.title),
		author: decodeEntities(oembed.author_name),
		description: decodeEntities(description),
	};
}

export async function fetchVideo(url: string, language: string): Promise<Video> {
	const info = ytDlpInfo(url);

	if (info === undefined) {
		return { ...(await fetchMetaWithoutYtDlp(url)), transcript: undefined };
	}

	const track = pickCaptionTrack(info, language);
	const transcript = track === undefined ? undefined : vttToText(await fetchText(track.url));

	return {
		title: info.title ?? url,
		author: info.uploader ?? info.channel ?? '',
		description: info.description ?? '',
		transcript,
	};
}

function ytDlpInfo(url: string): YtDlpInfo | undefined {
	try {
		execFileSync('yt-dlp', ['--version'], { stdio: 'ignore' });
	} catch {
		return undefined;
	}

	const json = execFileSync('yt-dlp', ['--dump-single-json', '--skip-download', '--no-warnings', url], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		maxBuffer: 64 * 1024 * 1024,
		timeout: 60_000,
	});

	return JSON.parse(json) as YtDlpInfo;
}

async function fetchMetaWithoutYtDlp(url: string): Promise<VideoMeta> {
	const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
	const oembed = JSON.parse(await fetchText(oembedUrl)) as OembedResponse;
	const html = await fetchText(url).catch(() => '');

	return videoMetaFromPage(oembed, html);
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, { headers: { 'user-agent': 'keepwiki' }, signal: AbortSignal.timeout(20_000) });

	if (!response.ok) {
		throw new Error(`${url} answered ${response.status}.`);
	}

	return response.text();
}

function tracks(byLanguage: Readonly<Record<string, readonly CaptionFormat[]>>, isAutomatic: boolean): CaptionTrack[] {
	return Object.entries(byLanguage).flatMap(([language, formats]) => {
		const vtt = formats.find((format) => format.ext === 'vtt');

		return vtt === undefined ? [] : [{ language, url: vtt.url, isAutomatic }];
	});
}

function matchesLanguage(track: CaptionTrack, code: string): boolean {
	return track.language === code || track.language.startsWith(`${code}-`);
}

function isCueMetadata(line: string): boolean {
	return (
		line.startsWith('WEBVTT') ||
		line.startsWith('Kind:') ||
		line.startsWith('Language:') ||
		line.startsWith('NOTE') ||
		line.includes('-->')
	);
}

function idOrUndefined(candidate: string): string | undefined {
	return /^[A-Za-z0-9_-]{6,}$/.test(candidate) ? candidate : undefined;
}
