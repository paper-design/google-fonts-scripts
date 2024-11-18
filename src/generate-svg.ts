import opentype from 'opentype.js';
import makerjs from 'makerjs';
import { optimize } from 'svgo';
import { fetchGoogleFonts } from './fetch-google-fonts';
import { findClosestVariantToNormalWeight } from './find-closest-variant-to-normal-weight';

export const OUTPUT_DIR = './output';
export const RAW_FONT_DATA_FILE = `${OUTPUT_DIR}/raw-font-data.json`;
export const SVG_TARGET_DIR = `${OUTPUT_DIR}/svg`;

async function main() {
  // ----- Grab the data from google ----- //
  const data: google.fonts.WebfontFamily[] = await fetchGoogleFonts();

  // ----- Build out the typeface data ----- //
  const typefaces = [];
  /** Stores typeface names and URLs to load and generate an SVG from */
  const familiesToGenerate: Array<[string, string]> = [];
  for (const typeface of data) {
    // Skip this one if we can't parse it
    if (!('family' in typeface) || !('variants' in typeface)) {
      console.warn(`Skipping typeface: ${typeface}`);
      continue;
    }

    const face: Typeface = {
      family: typeface.family,
      variants: [],
    };

    for (const variant of typeface.variants) {
      face.variants.push(variant);
    }

    typefaces.push(face);

    // Build the SVG to generate info
    // Pick the best variant, we just use the closest to 400
    const closestVariant = findClosestVariantToNormalWeight(typeface.variants);
    familiesToGenerate.push([typeface.family, typeface.files[closestVariant]]);
  }

  // ----- Write the typeface data to a file ----- //
  await Bun.write(RAW_FONT_DATA_FILE, JSON.stringify(typefaces, null, 2));

  // ----- Generate the SVGs ----- //

  for (const [typefaceName, url] of familiesToGenerate) {
    // Check if SVG already exists
    const svgPath = `${SVG_TARGET_DIR}/${typefaceName}.svg`;
    if (await Bun.file(svgPath).exists()) {
      console.log(`Skipping ${typefaceName} because SVG already exists`);
      continue;
    }

    // ----- Load the font ----- //
    let font: opentype.Font;
    try {
      const fontResponse = await fetch(url);
      const arrayBuffer = await fontResponse.arrayBuffer();
      // Parse the font
      font = await opentype.parse(arrayBuffer);
    } catch (e) {
      console.warn(`Skipping ${typefaceName} because it failed to load at: ${url}`);
      console.error(e);
      // continue;
      return;
    }

    // ----- Generate the SVG ----- //
    let textModel: makerjs.IModel;
    try {
      const size = 500;
      const union = true;
      const centerCharacterOrigin = false;
      // 0.5 = accurate to half a pixel, 0.001 = accurate to 1/1000th of a pixel, smaller numbers take longer to compute, undefined for auto
      const bezierAccuracy = undefined;
      const kerning = true;
      textModel = new makerjs.models.Text(font, typefaceName, size, union, centerCharacterOrigin, bezierAccuracy, {
        kerning,
      });
    } catch (e) {
      console.warn(`Skipping ${typefaceName} because it failed to generate at: ${url}`);
      console.error(e);
      continue;
    }

    // ----- Convert the model to an SVG ----- //
    let svgData: string;
    try {
      // @ts-expect-error
      const svg = makerjs.exporter.toSVG(textModel, {
        stroke: true,
        strokeWidth: 0.25, // this is necessary for good antialiasing and for the shape to look good small
        scalingStroke: true,
        fill: false,
        fillRule: 'nonzero', // usually used for font rendering
      });
      svgData = svg;

      // ----- Optimize the SVG ----- //
      const optimizedSvg = await optimize(svg, {
        multipass: true,
        floatPrecision: 4,
        plugins: ['preset-default'],
      });
      svgData = optimizedSvg.data;
    } catch (e) {
      console.warn(`Skipping ${typefaceName} because it failed to convert to SVG`);
      console.error(e);
      continue;
    }

    // ----- Write the optimized SVG to a file ----- //
    await Bun.write(svgPath, svgData!);

    // Add a delay between SVG generations
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log(`Generated SVG for ${typefaceName}`);
  }
}
main();
