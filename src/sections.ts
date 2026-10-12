export function sectionLines(text: string, heading: string): readonly string[] {
	const lines = text.split('\n');
	const start = lines.indexOf(heading);

	if (start === -1) {
		return [];
	}

	const rest = lines.slice(start + 1);
	const end = rest.findIndex((line) => line.startsWith('## '));

	return end === -1 ? rest : rest.slice(0, end);
}

export function sectionItems(text: string, heading: string): readonly string[] {
	return sectionLines(text, heading)
		.filter((line) => line.startsWith('- '))
		.map((line) => line.slice(2));
}
