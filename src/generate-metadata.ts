import { fetchGoogleFonts, fetchGoogleFontsMeta } from './fetch-google-fonts';

export const OUTPUT_DIR = './__generated__';

interface MinAxis {
  name: string;
  values: [minValue: number, defaultValue: number, maxValue: number];
  precision: number;
}

async function generateFonts() {
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

  return typefaces;
}

async function generateAxis() {
  const fontsMeta = await fetchGoogleFontsMeta();
  const registry: Record<string, MinAxis> = {};

  for (const axis of fontsMeta.axisRegistry) {
    registry[axis.tag] = {
      name: axis.displayName,
      precision: axis.precision,
      values: [axis.min, axis.defaultValue, axis.max],
    };
  }

  return registry;
}

function format(value: object) {
  // Format JSON with one font per line
  const fontEntries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  const jsonLines = fontEntries.map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  const formattedJson = '{\n' + jsonLines.join(',\n') + '\n}';
  return formattedJson;
}

async function main() {
  const [fonts, fontsMeta] = await Promise.all([generateFonts(), generateAxis()]);

  await Bun.write(`${OUTPUT_DIR}/metadata.json`, format(fonts));
  await Bun.write(`${OUTPUT_DIR}/axis.json`, format(fontsMeta));
}
main();
