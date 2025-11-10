import type { AxisRegistry, FamilyMetadataList, FamilyMetadataListAxe, Item } from '../output/google-fonts';
import { fetchGoogleFonts, fetchGoogleFontsMeta, fetchGoogleFontsVariable } from './fetch-google-fonts';
import { sortAxes } from './sort';
import { OUTPUT_DIR } from './vars';

const logSink: string[] = [];

interface FontValue {
  variants: string[];
  axes?: { min: number; max: number; tag: string; defaultValue: number }[];
}

async function generateFonts() {
  const { items: data } = await fetchGoogleFonts();
  const webfontsMeta = await fetchGoogleFontsVariable();
  const fontsMeta = await fetchGoogleFontsMeta();

  const typefaces: Record<string, FontValue> = {};

  const axesRegistryMap: Record<string, AxisRegistry> = fontsMeta.axisRegistry.reduce((acc, value) => {
    acc[value.tag] = value;
    return acc;
  }, {} as Record<string, AxisRegistry>);

  /**
   * This contains the font metadata including variable font axes if available.
   * We use this as the fallback source of truth if {@see fontsMetaMap} doesn't have axes data.
   */
  const webfontsMetaMap: Record<string, Item> = webfontsMeta.items.reduce((acc, value) => {
    acc[value.family] = value;
    return acc;
  }, {} as Record<string, Item>);

  /**
   * This contains the canonical metadata about font families and axes.
   * We use this data as the primary source of truth.
   */
  const fontsMetaMap: Record<string, FamilyMetadataList> = fontsMeta.familyMetadataList.reduce((acc, value) => {
    acc[value.family] = value;
    return acc;
  }, {} as Record<string, FamilyMetadataList>);

  for (const typeface of data) {
    // Skip this one if we can't parse it
    if (!('family' in typeface) || !('variants' in typeface)) {
      logSink.push(`Skipping typeface: ${typeface}`);
      continue;
    }

    const fallbackAxes =
      webfontsMetaMap[typeface.family]?.axes?.map(
        (axis): FamilyMetadataListAxe => ({
          defaultValue: axesRegistryMap[axis.tag].defaultValue ?? 0,
          max: axis.end,
          min: axis.start,
          tag: axis.tag,
        })
      ) || [];
    const actualAxes = fontsMetaMap[typeface.family]?.axes || [];
    const axes = actualAxes.length > 0 ? actualAxes : fallbackAxes;

    if (fallbackAxes.length !== actualAxes.length) {
      logSink.push(`invalid: axes count mismatch for ${typeface.family}`);
      logSink.push(`  expected: ${JSON.stringify(actualAxes)}`);
      logSink.push(`  fallback: ${JSON.stringify(fallbackAxes)}`);
      logSink.push('');
    }

    typefaces[typeface.family] = {
      variants: [],
      axes: axes.length
        ? axes
            .map((axis) => ({ tag: axis.tag, min: axis.min, max: axis.max, defaultValue: axis.defaultValue }))
            .sort((a, b) => sortAxes(a.tag, b.tag))
        : undefined,
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
  await Bun.write(`${OUTPUT_DIR}/metadata.log`, logSink.join('\n') + '\n');
}

main();
