import { chromium, type Browser, type BrowserContext } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fetchGoogleFonts } from './fetch-google-fonts';
import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

class FontPreviewGenerator {
  pngOutputDir: string;
  avifOutputDir: string;
  delay: number;
  maxRetries: number;
  browser: Browser | null;
  context: BrowserContext | null;
  completedFonts: Set<string>;
  errorFonts: Set<string>;
  fontLoadTimeout: number;

  /** Helper to promisify the `exec` command */
  execPromise: (command: string) => Promise<{ stdout: string; stderr: string }> = promisify(exec);

  constructor(options: { pngOutputDir: string; avifOutputDir: string; delay: number; maxRetries: number }) {
    this.pngOutputDir = options.pngOutputDir ?? 'png';
    this.avifOutputDir = options.avifOutputDir ?? 'avif';
    this.delay = options.delay || 1000;
    this.maxRetries = options.maxRetries || 3;
    this.browser = null;
    this.context = null;
    this.completedFonts = new Set();
    this.errorFonts = new Set();
    this.fontLoadTimeout = 5000;
  }

  async initialize() {
    // Launch browser with specific configuration for long-running process
    this.browser = await chromium.launch({
      handleSIGINT: true,
      handleSIGTERM: true,
      handleSIGHUP: true,
    });

    this.context = await this.browser.newContext({
      deviceScaleFactor: 2,
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async generatePreview(fontFamily: string, pngPath: string, avifPath: string, retryCount = 0) {
    const page = await this.context?.newPage();
    if (!page) throw new Error('No page found');

    try {
      const html = `
        <html>
          <head>
            <link href="https://fonts.googleapis.com/css2?family=${fontFamily.replace(
              /\s+/g,
              '+'
            )}&display=block" rel="stylesheet">
            <style>
              body {
                margin: 0;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .text {
                font-family: '${fontFamily}', sans-serif;
                font-size: 48px;
                font-weight: 400;
                color: #000000;
                white-space: nowrap;
                /* 50px padding on all sides to capture fonts that overflow their padding-box, we will chop it down later */
                padding: 50px;
                margin: 0;
                height: max-content;
                width: max-content;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
            </style>
          </head>
          <body>
            <div class="text">${fontFamily}</div>
          </body>
        </html>
      `;

      await page.setContent(html);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);

      // Make sure the font is actually loaded before taking the screenshot
      try {
        const fontLoaded = await Promise.race([
          page.waitForFunction(
            (fontFamily) => {
              if (document.fonts.check(`1em "${fontFamily}"`)) {
                return true;
              }
              return false;
            },
            fontFamily,
            { timeout: this.fontLoadTimeout }
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Font load timeout')), this.fontLoadTimeout)),
        ]);

        if (!fontLoaded) {
          throw new Error('Font failed to load properly');
        }
      } catch (error) {
        throw new Error(`Font loading verification failed: ${error}`);
      }

      const element = await page.locator('.text');
      await element.screenshot({
        path: pngPath,
        type: 'png',
        scale: 'device',
        omitBackground: true,
      });

      // Remove whitespace around the edges of the image and add just a little padding
      await sharp(pngPath)
        .trim()
        .extend({
          top: 2,
          bottom: 2,
          left: 2,
          right: 2,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .toFile(`${pngPath}.tmp`);

      // Replace the original with the trimmed version
      await fs.rename(`${pngPath}.tmp`, pngPath);

      console.log(`✓ Generated PNG for ${fontFamily}`);

      // Generate AVIF
      await this.execPromise(`cavif --quality 90 --speed 1 -o "${avifPath}" "${pngPath}"`);
      console.log(`✓ Generated AVIF for ${fontFamily}`);

      this.completedFonts.add(fontFamily);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ Error generating preview for ${fontFamily}:`, error.message);
      } else {
        console.error(`✗ Error generating preview for ${fontFamily}:`, error);
      }

      if (retryCount < this.maxRetries) {
        console.log(`Retrying ${fontFamily} (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, this.delay * 2));
        await this.generatePreview(fontFamily, pngPath, avifPath, retryCount + 1);
      } else {
        console.error(`Failed to generate preview for ${fontFamily} after ${this.maxRetries} attempts`);
        this.errorFonts.add(fontFamily);
      }
    } finally {
      await page.close();
    }
  }

  async generateBatch(fontFamilies: string[]) {
    try {
      await this.initialize();

      console.log(`Starting batch process for ${fontFamilies.length} fonts`);
      console.log(`Output directories:\n${this.pngOutputDir}\n${this.avifOutputDir}`);

      for (let i = 0; i < fontFamilies.length; i++) {
        const fontFamily = fontFamilies[i];
        console.log(`\nProcessing ${i + 1}/${fontFamilies.length}: ${fontFamily}`);

        // Generate the paths for this font family
        const pngPath = path.join(this.pngOutputDir, `${fontFamily.toLowerCase().replace(/\s+/g, '-')}.png`);
        const avifPath = path.join(this.avifOutputDir, `${fontFamily.toLowerCase().replace(/\s+/g, '-')}.avif`);
        if ((await Bun.file(pngPath).exists()) && (await Bun.file(avifPath).exists())) {
          console.log(`Skipping ${fontFamily} - PNG and AVIF already exist`);
          continue;
        }

        await this.generatePreview(fontFamily, pngPath, avifPath);

        // Add delay between fonts
        if (i < fontFamilies.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.delay));
        }
      }

      console.log('\nBatch processing complete!');
      console.log(`Successfully generated ${this.completedFonts.size} previews`);
      console.log(`Failed to generate previews for ${this.errorFonts.size} fonts`);
      console.log(`Error families: ${Array.from(this.errorFonts).join(', ')}`);
      console.log(`Output directories:\n${this.pngOutputDir}\n${this.avifOutputDir}`);
    } catch (error) {
      console.error('Batch process error:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Example usage
async function main() {
  // Get the list of all Google Font families

  const googleFonts = await fetchGoogleFonts();
  const fontFamilies = googleFonts.map((font) => font.family);

  // Skip if PNG and AVIF files already exist in output directory
  const outputDir = 'output/';
  const pngOutputDir = path.join(outputDir, 'png');
  const avifOutputDir = path.join(outputDir, 'avif');
  // Create PNG and AVIF directories if they don't exist
  await fs.mkdir(pngOutputDir, { recursive: true });
  await fs.mkdir(avifOutputDir, { recursive: true });

  const generator = new FontPreviewGenerator({
    pngOutputDir,
    avifOutputDir,
    delay: 500, // 0.5 second delay between fonts
    maxRetries: 2,
  });

  await generator.generateBatch(fontFamilies);
}

main().catch(console.error);
