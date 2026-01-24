import type { AxisRegistry, FamilyMetadataList, FamilyMetadataListAxis, Item } from '../output/google-fonts';
import { extractFeatures } from './extract-opentype-features';
import { fetchGoogleFonts, fetchGoogleFontsMeta, fetchGoogleFontsVariable } from './fetch-google-fonts';
import { findClosestVariantToNormalWeight } from './find-closest-variant-to-normal-weight';
import opentype from '@paper-design/opentype.js';
import { sortAxes } from './sort';
import { OUTPUT_DIR } from './vars';

const logSink: string[] = [];

export interface FontValue {
  variants: string[];
  axes?: { min: number; max: number; tag: string; defaultValue: number }[];
  // features?: { tag: string; name?: string }[];
  features?: 1;
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
        (axis): FamilyMetadataListAxis => ({
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

    // Download and parse font to extract OpenType features
    // @TODO: we'll actually want to track two arrays, one for the normal weights and one for the italic weights
    const closestVariant = findClosestVariantToNormalWeight(typeface.variants);
    const fontUrl = typeface.files[closestVariant];
    if (fontUrl) {
      try {
        console.log(`Downloading font ${fontUrl}...`);

        const response = await fetch(fontUrl);
        const buffer = await response.arrayBuffer();
        const font = opentype.parse(buffer);
        const features = extractFeatures(font);
        if (Object.keys(features).length > 0) {
          // Note: Google Fonts doesn't serve features when requesting the fonts yet,
          // but we know which fonts have which features from our script because we download and parse them.
          // For now, we just set `.features` to 1 to indicate that the font has features.
          // In the future, if we decide to host and serve the fonts ourselves, we can return the actual `features` object.

          // typefaces[typeface.family].features = features;
          typefaces[typeface.family].features = 1;
        }
      } catch (e) {
        logSink.push(`Failed to extract features for ${typeface.family}: ${e}`);
      }
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
