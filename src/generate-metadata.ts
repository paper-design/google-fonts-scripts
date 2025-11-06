import { fetchGoogleFonts } from './fetch-google-fonts';

export const OUTPUT_DIR = './output';
export const METADATA_FILE = `${OUTPUT_DIR}/metadata.json`;

async function main() {
  const { items: data } = await fetchGoogleFonts();

  const typefaces: Record<string, string[]> = {};

  for (const typeface of data) {
    // Skip this one if we can't parse it
    if (!('family' in typeface) || !('variants' in typeface)) {
      console.warn(`Skipping typeface: ${typeface}`);
      continue;
    }

    typefaces[typeface.family] = [];
    for (const variant of typeface.variants) {
      const key = variant === 'regular' ? '400' : variant === 'italic' ? '400i' : variant.replace('italic', 'i');
      typefaces[typeface.family].push(key);
    }
  }

  // Format JSON with one font per line
  const fontEntries = Object.entries(typefaces).sort(([a], [b]) => a.localeCompare(b));
  const jsonLines = fontEntries.map(([family, weights]) => `  ${JSON.stringify(family)}: ${JSON.stringify(weights)}`);
  const formattedJson = '{\n' + jsonLines.join(',\n') + '\n}';

  await Bun.write(METADATA_FILE, formattedJson);
}
main();
