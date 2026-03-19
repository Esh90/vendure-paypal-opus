import { generateDatesFile } from '@vendure-io/docs-provider';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(packageRoot, 'src/dates.generated.ts');

const result = await generateDatesFile({
    docsDir: join(packageRoot, 'docs'),
    outputPath,
    gitCwd: packageRoot,
});

// Post-process to fix Windows backslashes in paths which cause TS errors
const content = readFileSync(outputPath, 'utf8');
const finalContent = content.replace(/'docs\\(.*?\.mdx)':/g, (match) => match.replace(/\\/g, '/'));
writeFileSync(outputPath, finalContent);

console.log(`Generated dates.generated.ts`);
console.log(`  Files with dates: ${result.filesWithDates}`);
console.log(`  Files skipped: ${result.filesSkipped}`);
