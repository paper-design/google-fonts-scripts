import potpack from 'potpack';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { FAMILIES_TO_SKIP_PREVIEW_IMAGE } from './families-to-skip';
import { OUTPUT_DIR } from './vars';
import type { FontValue } from './generate-metadata';

const FONTS_PER_CHUNK = 100;
const DESIRED_HEIGHT = 32; // 16px-tall container in Paper, x2 for high DPI screens

type FontBox = {
  w: number;
  h: number;
  x?: number;
  y?: number;
  fontName: string;
  fileName: string;
  variants: string[];
  axes?: { min: number; max: number; tag: string; defaultValue: number }[];
  buffer?: Buffer;
  noPreview?: boolean;
};

type FontMetadata = {
  /**
   * x position of the font preview in the chunk image
   */
  x: number;
  /**
   * y position of the font preview in the chunk image
   */
  y: number;
  /**
   * width of the font preview in the chunk image
   */
  w: number;
  /**
   * chunk index where the font preview is located
   */
  ch: number;
  /**
   * variants available for the font
   */
  s: string[];
  /**
   * axes available for the font
   */
  a?: { min: number; max: number; tag: string; defaultValue: number }[];
  /**
   * indicates if the font has no preview image
   */
  noPreview?: boolean;
};

const createFontChunks = async () => {
  console.log('📂 Reading font data from metadata.json...');

  // Read the generated font data
  const fontDataPath = join(process.cwd(), OUTPUT_DIR, 'metadata.json');
  const fontDataContent = await readFile(fontDataPath, 'utf8');
  const fontData: Record<string, FontValue> = JSON.parse(fontDataContent);

  // Create array of font entries and sort alphabetically
  const fontEntries = Object.entries(fontData).sort(([a], [b]) => a.localeCompare(b));

  console.log(`📊 Found ${fontEntries.length} fonts in font data`);

  // Ensure chunks directory exists
  const chunksDir = join(process.cwd(), OUTPUT_DIR, 'font-chunks');
  if (!existsSync(chunksDir)) {
    await mkdir(chunksDir, { recursive: true });
    console.log('📁 Created chunks directory');
  }

  // Read dimensions and buffer for each font
  const boxes: FontBox[] = [];
  const pngDir = join(process.cwd(), OUTPUT_DIR, 'png');
  let missingFiles = 0;

  for (const [fontName, styles] of fontEntries) {
    // Convert font name to filename (kebab-case)
    const fileName = fontName.toLowerCase().replace(/\s+/g, '-');
    const filePath = join(pngDir, `${fileName}.png`);

    // Skip fonts that are expected to not have preview images
    if (FAMILIES_TO_SKIP_PREVIEW_IMAGE.has(fontName)) {
      boxes.push({
        w: 0,
        h: 0,
        fontName,
        fileName,
        variants: styles.variants,
        axes: styles.axes,
        noPreview: true,
      });
      continue;
    }

    // Check if file exists before trying to process it
    if (!existsSync(filePath)) {
      console.warn(`⚠️  PNG file missing for font "${fontName}" (expected: ${fileName}.png)`);
      missingFiles++;
      // Add placeholder entry for missing PNG
      boxes.push({
        w: 0,
        h: 0,
        fontName,
        fileName,
        variants: styles.variants,
        axes: styles.axes,
        noPreview: true,
      });
      continue;
    }

    try {
      const originalBuffer = await sharp(filePath).png().toBuffer();
      const metadata = await sharp(originalBuffer).metadata();

      if (metadata.width && metadata.height) {
        // Calculate new dimensions while preserving aspect ratio
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;
        const aspectRatio = originalWidth / originalHeight;
        const newWidth = Math.round(DESIRED_HEIGHT * aspectRatio);
        const newHeight = DESIRED_HEIGHT;

        // Resize the image in memory
        const resizedBuffer = await sharp(originalBuffer).resize(newWidth, newHeight).png().toBuffer();

        boxes.push({
          w: newWidth,
          h: newHeight,
          fontName,
          fileName,
          variants: styles.variants,
          axes: styles.axes,
          buffer: resizedBuffer,
        });
      } else {
        console.warn(`⚠️  Could not read dimensions for "${fontName}" (${fileName}.png)`);
        missingFiles++;

        // Add placeholder entry for invalid PNG
        boxes.push({
          w: 0,
          h: 0,
          fontName,
          fileName,
          variants: styles.variants,
          axes: styles.axes,
          noPreview: true,
        });
      }
    } catch (error) {
      console.warn(
        `⚠️  Error processing ${fileName}.png for font "${fontName}": ${error instanceof Error ? error.message : error}`
      );
      missingFiles++;

      // Add placeholder entry for errored PNG
      boxes.push({
        w: 0,
        h: 0,
        fontName,
        fileName,
        variants: styles.variants,
        axes: styles.axes,
        noPreview: true,
      });
    }
  }

  const validBoxes = boxes.filter((box) => !box.noPreview);
  const noPreviewBoxes = boxes.filter((box) => box.noPreview);

  console.log(`✅ Successfully processed ${validBoxes.length} images`);
  if (missingFiles > 0) {
    console.log(`⚠️  ${missingFiles} fonts marked as no preview due to missing or invalid PNG files`);
  }

  // Ensure boxes are sorted alphabetically by font name
  boxes.sort((a, b) => a.fontName.localeCompare(b.fontName));

  // Split valid boxes into chunks for packing
  const validChunks: FontBox[][] = [];
  for (let i = 0; i < validBoxes.length; i += FONTS_PER_CHUNK) {
    validChunks.push(validBoxes.slice(i, i + FONTS_PER_CHUNK));
  }

  console.log(`📦 Split valid images into ${validChunks.length} chunks of ${FONTS_PER_CHUNK} fonts each`);

  const results = [];
  const allFontMetadata: { [fontName: string]: FontMetadata } = {};
  const chunks: { w: number; h: number }[] = [];

  // Process each chunk of valid boxes
  for (let chunkIndex = 0; chunkIndex < validChunks.length; chunkIndex++) {
    const chunk = validChunks[chunkIndex];

    console.log(`\n🎯 Processing chunk ${chunkIndex}/${validChunks.length - 1} (${chunk.length} fonts)...`);

    // Use potpack to calculate optimal layout for this chunk
    const result = potpack(chunk);

    console.log(`📐 Chunk ${chunkIndex} canvas dimensions: ${result.w} x ${result.h}`);
    console.log(`📦 Chunk ${chunkIndex} fill ratio: ${(result.fill * 100).toFixed(1)}%`);

    // Store chunk dimensions
    chunks.push({ w: result.w, h: result.h });

    // Create the composite image for this chunk
    console.log(`🎨 Creating chunk ${chunkIndex} AVIF image...`);

    // Create a transparent background canvas
    const canvas = sharp({
      create: {
        width: result.w,
        height: result.h,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    // Prepare composite operations for all positioned images in this chunk
    const compositeOps = chunk.map((box) => ({
      input: box.buffer!,
      top: box.y!,
      left: box.x!,
    }));

    // Create optimized image format composite for this chunk
    const outputPath = join(process.cwd(), OUTPUT_DIR, 'font-chunks', `font-chunk-${chunkIndex}.avif`);
    await canvas
      .composite(compositeOps)
      .avif({ quality: 70 })
      // .webp({ quality: 50, nearLossless: true })
      .toFile(outputPath);

    console.log(`🎉 Chunk ${chunkIndex} AVIF created: ${outputPath}`);

    // Add metadata for this chunk to the global metadata object
    chunk.forEach((box) => {
      allFontMetadata[box.fontName] = {
        x: box.x!,
        y: box.y!,
        w: box.w,
        ch: chunkIndex,
        s: box.variants,
        a: box.axes,
      };
    });

    results.push({
      chunkNumber: chunkIndex,
      width: result.w,
      height: result.h,
      totalImages: chunk.length,
      fillRatio: result.fill,
      outputPath,
    });
  }

  // Add metadata for fonts with no preview
  noPreviewBoxes.forEach((box) => {
    allFontMetadata[box.fontName] = {
      x: 0,
      y: 0,
      w: 0,
      ch: 0,
      s: box.variants,
      a: box.axes,
      noPreview: true,
    };
  });

  // Write the single JSON file with all font metadata
  console.log('\n📝 Generating unified font metadata JSON...');

  // Create sorted object to ensure consistent ordering
  const sortedFontNames = Object.keys(allFontMetadata).sort();

  // Format JSON with one font per line for the fonts object
  const fontJsonLines = sortedFontNames.map(
    (fontName) => `    ${JSON.stringify(fontName)}: ${JSON.stringify(allFontMetadata[fontName])}`
  );
  const fontsJson = '{\n' + fontJsonLines.join(',\n') + '\n  }';

  // Format chunks with one chunk per line
  const chunkJsonLines = chunks.map((chunk) => `    ${JSON.stringify(chunk)}`);
  const chunksJson = '[\n' + chunkJsonLines.join(',\n') + '\n  ]';

  // Format the complete structure
  const completeJson = `{
  "fonts": ${fontsJson},
  "chunks": ${chunksJson}
}`;

  const jsonOutputPath = join(process.cwd(), OUTPUT_DIR, 'font-chunks', 'fonts.json');
  await writeFile(jsonOutputPath, completeJson, 'utf8');

  console.log(`📄 Unified font metadata JSON created: ${jsonOutputPath}`);
  console.log(`✨ All ${validChunks.length} chunks created successfully!`);

  return {
    totalChunks: validChunks.length,
    totalImages: validBoxes.length,
    totalFontsInData: fontEntries.length,
    missingFiles,
    fontsPerChunk: FONTS_PER_CHUNK,
    jsonOutputPath,
    chunks: results,
  };
};

createFontChunks()
  .then((result) => {
    console.log('\n🎊 Chunk creation completed!');
    console.log(`📈 Summary: ${result.totalImages} fonts processed out of ${result.totalFontsInData} fonts in data`);
    if (result.missingFiles > 0) {
      console.log(`⚠️  ${result.missingFiles} fonts were marked as no preview due to missing PNG files`);
    }
    console.log(`📦 Split into ${result.totalChunks} chunks`);
    result.chunks.forEach((chunk) => {
      console.log(
        `   Chunk ${chunk.chunkNumber}: ${chunk.totalImages} fonts, ${chunk.width}x${chunk.height}px, ${(
          chunk.fillRatio * 100
        ).toFixed(1)}% fill`
      );
    });
  })
  .catch((error) => {
    console.error('💥 Error creating font chunks:', error);
    process.exit(1);
  });
