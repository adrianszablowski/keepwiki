export interface RegistryEntry {
	readonly name: string;
	readonly path: string;
	readonly description: string;
	readonly language: string;
}

export interface Registry {
	readonly home: string;
	readonly inbox: string;
	readonly vaults: readonly RegistryEntry[];
}

export const registryColumns = ['name', 'path', 'description', 'language'] as const;

export const vaultNamePattern = /^[a-z0-9][a-z0-9-]*$/;

export const registryHeader = `| ${registryColumns.join(' | ')} |`;
const separatorRow = `| ${registryColumns.map(() => '---').join(' | ')} |`;

export function emptyRegistry(home: string): Registry {
	return { home, inbox: `${home}/inbox`, vaults: [] };
}

export function parseRegistry(text: string): Registry {
	const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
	const fields = new Map(
		(frontmatter?.[1] ?? '').split('\n').map((line) => {
			const [key, ...rest] = line.split(':');

			return [key?.trim() ?? '', rest.join(':').trim()];
		}),
	);
	const home = fields.get('home') ?? '~/keepwiki';
	const inbox = fields.get('inbox') ?? `${home}/inbox`;
	const vaults = text
		.split('\n')
		.filter((line) => line.startsWith('|') && line !== registryHeader && line !== separatorRow)
		.map(parseRow);

	return { home, inbox, vaults };
}

export function renderRegistry(registry: Registry): string {
	const rows = registry.vaults.map(renderRow);

	return [
		'---',
		`home: ${registry.home}`,
		`inbox: ${registry.inbox}`,
		'---',
		'',
		'# keepwiki registry',
		'',
		registryHeader,
		separatorRow,
		...rows,
		'',
	].join('\n');
}

export function addVault(registry: Registry, entry: RegistryEntry): Registry {
	if (!vaultNamePattern.test(entry.name)) {
		throw new Error(
			`Vault name "${entry.name}" must match ${vaultNamePattern}: lowercase letters, digits and hyphens.`,
		);
	}

	if (registry.vaults.some((vault) => vault.name === entry.name)) {
		throw new Error(`A vault named "${entry.name}" is already in the registry.`);
	}

	for (const value of Object.values(entry)) {
		if (value.includes('|')) {
			throw new Error(`"${value}" contains "|", which would split the registry row.`);
		}
	}

	return { ...registry, vaults: [...registry.vaults, entry] };
}

function parseRow(line: string): RegistryEntry {
	const cells = line
		.split('|')
		.slice(1, -1)
		.map((cell) => cell.trim());
	const [name = '', path = '', description = '', language = ''] = cells;

	return { name, path, description, language };
}

function renderRow(entry: RegistryEntry): string {
	return `| ${registryColumns.map((column) => entry[column]).join(' | ')} |`;
}
