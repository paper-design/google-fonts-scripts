import potpack from 'potpack';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { FAMILIES_TO_SKIP_PREVIEW_IMAGE } from './families-to-skip';

const FONTS_PER_CHUNK = 50;
const DESIRED_HEIGHT = 32; // 16px-tall container in Paper, x2 for high DPI screens

type FontBox = {
  w: number;
  h: number;
  x?: number;
  y?: number;
  fontName: string;
  fileName: string;
  weights: string[];
  buffer?: Buffer;
  noPreview?: boolean;
};

type FontMetadata = {
  n: string;
  x: number;
  y: number;
  w: number;
  ch: number;
  f: string[];
  noPreview?: boolean;
};

const createFontChunks = async () => {
  console.log('📂 Reading font data from metadata.json...');

  // Read the generated font data
  const fontDataPath = join(process.cwd(), 'output', 'metadata.json');
  const fontDataContent = await readFile(fontDataPath, 'utf8');
  const fontData = JSON.parse(fontDataContent);

  // Create array of font entries and sort alphabetically
  const fontEntries = Object.entries(fontData).sort(([a], [b]) => a.localeCompare(b));

  console.log(`📊 Found ${fontEntries.length} fonts in font data`);

  // Ensure chunks directory exists
  const chunksDir = join(process.cwd(), 'output', 'font-chunks');
  if (!existsSync(chunksDir)) {
    await mkdir(chunksDir, { recursive: true });
    console.log('📁 Created chunks directory');
  }

  // Read dimensions and buffer for each font
  const boxes: FontBox[] = [];
  const pngDir = join(process.cwd(), 'output', 'png');
  let missingFiles = 0;

  for (const [fontName, weights] of fontEntries) {
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
        weights: weights as string[],
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
        weights: weights as string[],
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
          weights: weights as string[],
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
          weights: weights as string[],
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
        weights: weights as string[],
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
  const allFontMetadata: FontMetadata[] = [];

  // Process each chunk of valid boxes
  for (let chunkIndex = 0; chunkIndex < validChunks.length; chunkIndex++) {
    const chunk = validChunks[chunkIndex];
    const chunkNumber = chunkIndex + 1;

    console.log(`\n🎯 Processing chunk ${chunkNumber}/${validChunks.length} (${chunk.length} fonts)...`);

    // Use potpack to calculate optimal layout for this chunk
    const result = potpack(chunk);

    console.log(`📐 Chunk ${chunkNumber} canvas dimensions: ${result.w} x ${result.h}`);
    console.log(`📦 Chunk ${chunkNumber} fill ratio: ${(result.fill * 100).toFixed(1)}%`);

    // Create the composite image for this chunk
    console.log(`🎨 Creating chunk ${chunkNumber} AVIF image...`);

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
    const outputPath = join(process.cwd(), 'output', 'font-chunks', `font-chunk-${chunkNumber}.avif`);
    await canvas
      .composite(compositeOps)
      .avif({ quality: 70 })
      // .webp({ quality: 50, nearLossless: true })
      .toFile(outputPath);

    console.log(`🎉 Chunk ${chunkNumber} AVIF created: ${outputPath}`);

    // Add metadata for this chunk to the global metadata array
    const chunkMetadata: FontMetadata[] = chunk.map((box) => ({
      n: box.fontName,
      x: box.x!,
      y: box.y!,
      w: box.w,
      ch: chunkNumber,
      f: box.weights,
    }));

    // Sort chunk metadata alphabetically to ensure consistent ordering
    chunkMetadata.sort((a, b) => a.n.localeCompare(b.n));

    allFontMetadata.push(...chunkMetadata);

    results.push({
      chunkNumber,
      width: result.w,
      height: result.h,
      totalImages: chunk.length,
      fillRatio: result.fill,
      outputPath,
    });
  }

  // Add metadata for fonts with no preview
  const noPreviewMetadata: FontMetadata[] = noPreviewBoxes.map((box) => ({
    n: box.fontName,
    x: 0,
    y: 0,
    w: 0,
    ch: 0,
    f: box.weights,
    noPreview: true,
  }));

  allFontMetadata.push(...noPreviewMetadata);

  // Write the single JSON file with all font metadata
  console.log('\n📝 Generating unified font metadata JSON...');

  // Final sort to ensure perfect alphabetical order in the JSON
  allFontMetadata.sort((a, b) => a.n.localeCompare(b.n));

  // Format JSON with one font per line
  const jsonLines = allFontMetadata.map((font) => JSON.stringify(font));
  const compactJson = '[\n' + jsonLines.join(',\n') + '\n]';

  const jsonOutputPath = join(process.cwd(), 'output', 'font-chunks', 'fonts.json');
  await writeFile(jsonOutputPath, compactJson, 'utf8');

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