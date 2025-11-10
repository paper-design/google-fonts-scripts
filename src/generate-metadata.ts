import type { Item } from '../output/google-fonts';
import { fetchGoogleFonts, fetchGoogleFontsMeta, fetchGoogleFontsVariable } from './fetch-google-fonts';
import { sortAxes } from './sort';
import { OUTPUT_DIR } from './vars';

interface FontValue {
  variants: string[];
  axes?: { min: number; max: number; tag: string }[];
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

    typefaces[typeface.family] = {
      variants: [],
      axes: variableFontMap[typeface.family].axes
        ?.map((axis) => ({ tag: axis.tag, min: axis.start, max: axis.end }))
        .sort((a, b) => sortAxes(a.tag, b.tag)),
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
  const registry: Record<string, string> = {};

  for (const axis of fontsMeta.axisRegistry) {
    registry[axis.tag] = axis.displayName;
  }

  return registry;
}

function format(value: object, sort: (a: string, b: string) => number = (a, b) => a.localeCompare(b)) {
  // Format JSON with one font per line
  const fontEntries = Object.entries(value).sort(([a], [b]) => sort(a, b));
  const jsonLines = fontEntries.map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  const formattedJson = '{\n' + jsonLines.join(',\n') + '\n}\n';
  return formattedJson;
}

async function main() {
  const [fonts, fontsMeta] = await Promise.all([generateFonts(), generateAxis()]);

  await Bun.write(`${OUTPUT_DIR}/metadata.json`, format(fonts));
  await Bun.write(`${OUTPUT_DIR}/axes.json`, format(fontsMeta, sortAxes));
}

main();
