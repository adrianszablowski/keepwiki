export type Frontmatter = Readonly<Record<string, string | undefined>>;

export function parseFrontmatter(text: string): ReadonlyMap<string, string> {
	const block = text.match(frontmatterPattern)?.[1] ?? '';

	return new Map(
		block.split('\n').map((line) => {
			const [key, ...rest] = line.split(':');

			return [key?.trim() ?? '', rest.join(':').trim()];
		}),
	);
}

export function frontmatterList(text: string, key: string): readonly string[] {
	const lines = (text.match(frontmatterPattern)?.[1] ?? '').split('\n');
	const start = lines.findIndex((line) => line.startsWith(`${key}:`));

	if (start === -1) {
		return [];
	}

	const items: string[] = [];

	for (const line of lines.slice(start + 1)) {
		const item = line.match(/^\s+-\s+(.*)$/)?.[1];

		if (item === undefined) {
			break;
		}

		items.push(item.trim());
	}

	return items;
}

export function renderFrontmatter(fields: Frontmatter): string {
	const lines = Object.entries(fields)
		.filter((entry): entry is [string, string] => entry[1] !== undefined)
		.map(([key, value]) => `${key}: ${value}`);

	return ['---', ...lines, '---'].join('\n');
}

export function setFrontmatterField(text: string, key: string, value: string | undefined): string {
	const match = text.match(frontmatterPattern);

	if (!match) {
		return text;
	}

	const lines = (match[1] ?? '').split('\n');
	const isPresent = lines.some((line) => line.startsWith(`${key}:`));
	const replaced = lines.flatMap((line) =>
		line.startsWith(`${key}:`) ? (value === undefined ? [] : [`${key}: ${value}`]) : [line],
	);
	const updated = isPresent || value === undefined ? replaced : [...replaced, `${key}: ${value}`];

	return text.replace(frontmatterPattern, ['---', ...updated, '---'].join('\n'));
}

const frontmatterPattern = /^---\n([\s\S]*?)\n---/;
