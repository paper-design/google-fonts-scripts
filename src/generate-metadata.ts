import type { Item } from '../__generated__/google-fonts';
import { fetchGoogleFonts, fetchGoogleFontsMeta, fetchGoogleFontsVariable } from './fetch-google-fonts';

export const OUTPUT_DIR = './__generated__';

interface AxisValue {
  name: string;
  values: [minValue: number, defaultValue: number, maxValue: number];
  precision: number;
}

interface FontValue {
  variants: string[];
  axes?: string[];
}

async function generateFonts() {
  const { items: data } = await fetchGoogleFonts();
  const fontsMeta = await fetchGoogleFontsVariable();

  const typefaces: Record<string, FontValue> = {};
  const variableFontMap: Record<string, Item> = fontsMeta.items.reduce((acc, value) => {
    acc[value.family] = value;
    return acc;
  }, {} as Record<string, Item>);

  for (const typeface of data) {
    // Skip this one if we can't parse it
    if (!('family' in typeface) || !('variants' in typeface)) {
      console.warn(`Skipping typeface: ${typeface}`);
      continue;
    }

    const axes = variableFontMap[typeface.family].axes;

    typefaces[typeface.family] = {
      variants: [],
      axes: axes ? axes.map((axis) => axis.tag) : undefined,
    };

    for (const variant of typeface.variants) {
      const key = variant === 'regular' ? '400' : variant === 'italic' ? '400i' : variant.replace('italic', 'i');
      typefaces[typeface.family].variants.push(key);
    }
  }

  return typefaces;
}

async function generateAxis() {
  const fontsMeta = await fetchGoogleFontsMeta();
  const registry: Record<string, AxisValue> = {};

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
