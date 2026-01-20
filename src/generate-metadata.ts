import type { AxisRegistry, FamilyMetadataList, FamilyMetadataListAxe, Item } from '../output/google-fonts';
import { extractFeatures } from './extract-opentype-features';
import { fetchGoogleFonts, fetchGoogleFontsMeta, fetchGoogleFontsVariable } from './fetch-google-fonts';
import { findClosestVariantToNormalWeight } from './find-closest-variant-to-normal-weight';
import { FONT_FEATURE_NAMES } from './font-feature-names';
import opentype from '@paper-design/opentype.js';
import { sortAxes } from './sort';
import { OUTPUT_DIR } from './vars';

const logSink: string[] = [];

export interface FontValue {
  variants: string[];
  axes?: { min: number; max: number; tag: string; defaultValue: number }[];
  features?: { tag: string; name?: string }[];
}

/**
 * Filters features to only include those listed in FONT_FEATURE_NAMES
 */
function filterKnownFeatures(features: { tag: string; name?: string }[]): { tag: string; name?: string }[] {
  return features.filter((f) => f.tag in FONT_FEATURE_NAMES);
}

/**
 * Extracts weight number from variant string for sorting
 * "regular" -> 400, "italic" -> 400, "700italic" -> 700, "300" -> 300
 */
function getVariantWeight(variant: string): number {
  if (variant === 'regular' || variant === 'italic') {
    return 400;
  }
  // Extract numeric weight from variant (e.g., "700italic" -> 700, "300" -> 300)
  const match = variant.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
}

/**
 * Sorts variants: all non-italic first (by weight), then all italic (by weight)
 * regular/italic treated as 400
 */
function sortVariants(
  variants: Array<{ variant: string; isItalic: boolean; features: { tag: string; name?: string }[] }>
): Array<{ variant: string; isItalic: boolean; features: { tag: string; name?: string }[] }> {
  return [...variants].sort((a, b) => {
    // First, separate non-italic from italic
    if (a.isItalic !== b.isItalic) {
      return a.isItalic ? 1 : -1; // non-italic comes first
    }
    // Within the same group (both italic or both non-italic), sort by weight
    const weightA = getVariantWeight(a.variant);
    const weightB = getVariantWeight(b.variant);
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return a.variant.localeCompare(b.variant);
  });
}

/**
 * Prints a table showing which variants have which features
 */
function printFeatureTable(
  variants: Array<{ variant: string; isItalic: boolean; features: { tag: string; name?: string }[] }>,
  allFeatures: string[]
) {
  // Sort variants by weight
  const sortedVariants = sortVariants(variants);

  // Calculate column widths
  const variantColWidth = 10;
  const featureColWidth = 4;

  // Print header
  const header = `  ${'Variant'.padEnd(variantColWidth)} | ${allFeatures
    .map((f) => f.padEnd(featureColWidth))
    .join(' | ')}`;
  console.log(header);
  console.log(
    '  ' + '-'.repeat(variantColWidth) + '-+-' + allFeatures.map(() => '-'.repeat(featureColWidth)).join('-+-')
  );

  // Print rows for each variant
  for (const variant of sortedVariants) {
    const variantFeatureTags = new Set(variant.features.map((f) => f.tag));
    const cells = allFeatures.map((tag) => {
      const hasFeature = variantFeatureTags.has(tag);
      return (hasFeature ? ' ✅' : ' ❌').padEnd(featureColWidth - 1);
    });
    console.log(`  ${variant.variant.padEnd(variantColWidth)} | ${cells.join(' | ')}`);
  }
  console.log('');
}

async function generateFonts() {
  const { items: data } = await fetchGoogleFonts();
  const webfontsMeta = await fetchGoogleFontsVariable();
  const fontsMeta = await fetchGoogleFontsMeta();

  const typefaces: Record<string, FontValue> = {};

  // Track fonts with inconsistencies
  const fontsWithNonItalicInconsistencies: string[] = [];
  const fontsWithItalicInconsistencies: string[] = [];
  const fontsWithItalicVsNonItalicDifferences: string[] = [];

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

    // console.log(typeface);

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

    // console.log(`${typeface.family}...`);

    // Track features for each variant group (italic vs non-italic)
    const variantFeatures: Array<{ variant: string; isItalic: boolean; features: { tag: string; name?: string }[] }> =
      [];

    // Download and parse font to extract OpenType features
    for (const [variant, url] of Object.entries(typeface.files)) {
      if (url) {
        try {
          const response = await fetch(url);
          const buffer = await response.arrayBuffer();
          const font = opentype.parse(buffer);
          const allFeatures = extractFeatures(font);
          const features = filterKnownFeatures(allFeatures);
          const isItalic = variant.includes('italic') || variant.includes('i');

          variantFeatures.push({
            variant,
            isItalic,
            features,
          });
        } catch (e) {
          logSink.push(`Failed to extract features for ${typeface.family} ${variant}: ${e}`);
        }
      }
    }

    // Validate feature consistency
    const nonItalicVariants = variantFeatures.filter((v) => !v.isItalic);
    const italicVariants = variantFeatures.filter((v) => v.isItalic);

    // Check consistency within non-italic variants
    if (nonItalicVariants.length > 1) {
      const allFeatures = new Set<string>();
      nonItalicVariants.forEach((v) => {
        v.features.forEach((f) => allFeatures.add(f.tag));
      });
      const sortedFeatures = Array.from(allFeatures).sort();

      // Check if there are any inconsistencies
      const hasInconsistencies = nonItalicVariants.some((v) => {
        const variantFeatureTags = new Set(v.features.map((f) => f.tag));
        return sortedFeatures.some((tag) => {
          const hasFeature = variantFeatureTags.has(tag);
          const firstHasFeature = nonItalicVariants[0].features.some((f) => f.tag === tag);
          return hasFeature !== firstHasFeature;
        });
      });

      if (hasInconsistencies) {
        fontsWithNonItalicInconsistencies.push(typeface.family);
        console.log(`\n⚠️ ${typeface.family}: feature inconsistencies detected in non-italic variants\n`);
        printFeatureTable(nonItalicVariants, sortedFeatures);
      }
    }

    // Check consistency within italic variants
    if (italicVariants.length > 1) {
      const allFeatures = new Set<string>();
      italicVariants.forEach((v) => {
        v.features.forEach((f) => allFeatures.add(f.tag));
      });
      const sortedFeatures = Array.from(allFeatures).sort();

      // Check if there are any inconsistencies
      const hasInconsistencies = italicVariants.some((v) => {
        const variantFeatureTags = new Set(v.features.map((f) => f.tag));
        return sortedFeatures.some((tag) => {
          const hasFeature = variantFeatureTags.has(tag);
          const firstHasFeature = italicVariants[0].features.some((f) => f.tag === tag);
          return hasFeature !== firstHasFeature;
        });
      });

      if (hasInconsistencies) {
        fontsWithItalicInconsistencies.push(typeface.family);
        console.log(`\n⚠️ ${typeface.family}: feature inconsistencies detected in italic variants\n`);
        printFeatureTable(italicVariants, sortedFeatures);
      }
    }

    // Compare italic vs non-italic (differences are expected and fine)
    if (nonItalicVariants.length > 0 && italicVariants.length > 0) {
      const allFeatures = new Set<string>();
      variantFeatures.forEach((v) => {
        v.features.forEach((f) => allFeatures.add(f.tag));
      });
      const sortedFeatures = Array.from(allFeatures).sort();

      // Check if there are differences between italic and non-italic
      const nonItalicFeatureSet = new Set<string>();
      nonItalicVariants.forEach((v) => {
        v.features.forEach((f) => nonItalicFeatureSet.add(f.tag));
      });
      const italicFeatureSet = new Set<string>();
      italicVariants.forEach((v) => {
        v.features.forEach((f) => italicFeatureSet.add(f.tag));
      });

      const hasDifferences = sortedFeatures.some((tag) => {
        const nonItalicHas = nonItalicFeatureSet.has(tag);
        const italicHas = italicFeatureSet.has(tag);
        return nonItalicHas !== italicHas;
      });

      if (hasDifferences) {
        fontsWithItalicVsNonItalicDifferences.push(typeface.family);
        console.log(
          `\nℹ️ ${typeface.family}: feature inconsistencies detected between italic and non-italic variants\n`
        );
        printFeatureTable(variantFeatures, sortedFeatures);
      }
    }

    // Store features from the first variant (or first non-italic if available)
    const featuresToStore =
      nonItalicVariants.length > 0
        ? nonItalicVariants[0].features
        : italicVariants.length > 0
        ? italicVariants[0].features
        : [];

    if (featuresToStore.length > 0) {
      typefaces[typeface.family].features = featuresToStore;
    }

    // return;
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  if (fontsWithNonItalicInconsistencies.length > 0) {
    console.log(
      `\n⚠️ Fonts with inconsistencies in non-italic variants (${fontsWithNonItalicInconsistencies.length}):`
    );
    fontsWithNonItalicInconsistencies.forEach((font) => console.log(`   - ${font}`));
  }

  if (fontsWithItalicInconsistencies.length > 0) {
    console.log(`\n⚠️ Fonts with inconsistencies in italic variants (${fontsWithItalicInconsistencies.length}):`);
    fontsWithItalicInconsistencies.forEach((font) => console.log(`   - ${font}`));
  }

  if (fontsWithItalicVsNonItalicDifferences.length > 0) {
    console.log(
      `\nℹ️ Fonts with differences between italic and non-italic variants (${fontsWithItalicVsNonItalicDifferences.length}):`
    );
    fontsWithItalicVsNonItalicDifferences.forEach((font) => console.log(`   - ${font}`));
  }

  if (
    fontsWithNonItalicInconsistencies.length === 0 &&
    fontsWithItalicInconsistencies.length === 0 &&
    fontsWithItalicVsNonItalicDifferences.length === 0
  ) {
    console.log('\n✓ No inconsistencies found!');
  }

  console.log('\n' + '='.repeat(80) + '\n');

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
