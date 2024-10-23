import opentype from 'opentype.js';
import makerjs from 'makerjs';

export const OUTPUT_DIR = './output';
export const RAW_FONT_DATA_FILE = `${OUTPUT_DIR}/raw-font-data.json`;
export const SVG_TARGET_DIR = `${OUTPUT_DIR}/svg`;

async function main() {
  // ----- Grab the data from google ----- //
  const data = (await fetchGoogleFonts())['familyMetadataList'];
  if (!Array.isArray(data)) throw new Error('Expected familyMetadataList to be an array');

  // ----- Build out the typeface data ----- //
  const typefaces = [];
  for (const typeface of data) {
    // Skip this one if we can't parse it
    if (!('family' in typeface) || !('fonts' in typeface)) {
      console.warn(`Skipping typeface: ${typeface}`);
      continue;
    }

    const face: Typeface = {
      family: typeface.family,
      variants: [],
    };

    for (const variant of Object.keys(typeface.fonts)) {
      face.variants.push(variant);
    }

    typefaces.push(face);
  }

  // ----- Write the typeface data to a file ----- //
  await Bun.write(RAW_FONT_DATA_FILE, JSON.stringify(typefaces, null, 2));

  // ----- Generate the SVGs ----- //
  let didOne = false;
  for (const typeface of typefaces) {
    // Check if SVG already exists
    const svgPath = `${SVG_TARGET_DIR}/${typeface.family}.svg`;
    if (await Bun.file(svgPath).exists()) {
      console.log(`Skipping ${typeface.family} because SVG already exists`);
      continue;
    }

    // Load the font
    let font;
    // const url = `https://fonts.googleapis.com/css2?family=${typeface.family}:wght@400&display=swap`;
    const url = `https://fonts.googleapis.com/css2?family=${typeface.family}&display=swap`;
    try {
      // TODO: pick best variant
      font = opentype.loadSync(url);
    } catch (e) {
      console.warn(`Skipping ${typeface.family} because it failed to load at: ${url}`);
      continue;
    }

    const size = 20;
    const union = false;
    const centerCharacterOrigin = false;
    // 0.5 = accurate to half a pixel, 0.001 = accurate to 1/1000th of a pixel, smaller numbers take longer to compute
    const bezierAccuracy = 0.01;
    const kerning = true;
    const textModel = new makerjs.models.Text(
      font,
      typeface.family,
      size,
      union,
      centerCharacterOrigin,
      bezierAccuracy,
      { kerning }
    );

    const svg = makerjs.exporter.toSVG(textModel, {
      fill: false,
      stroke: false,
      strokeWidth: undefined,
      fillRule: undefined,
      scalingStroke: true,
    });

    await Bun.write(svgPath, svg);

    if (didOne) {
      break;
    }
    didOne = true;
  }
}
main();

type Typeface = {
  family: string;
  variants: string[];
};

async function fetchGoogleFonts() {
  const dataUrl = 'https://fonts.google.com/metadata/fonts';
  const response = await fetch(dataUrl);
  const data = await response.json();
  return data;
}
