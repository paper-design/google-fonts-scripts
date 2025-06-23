import potpack from 'potpack'
import sharp from 'sharp'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { writeFile } from 'fs/promises'

type FontBox = {
  w: number
  h: number
  x?: number
  y?: number
  filename: string
  buffer: Buffer
}

type FontMetadata = {
  n: string
  x: number
  y: number
  w: number
  h: number
}

const createFontBundle = async () => {
  console.log('📂 Reading PNG files from output/png directory...')
  
  // Read all PNG files from the directory
  const pngDir = join(process.cwd(), 'output', 'png')
  const files = await readdir(pngDir)
  const pngFiles = files.filter(file => file.endsWith('.png'))
  
  console.log(`📊 Found ${pngFiles.length} PNG files`)
  
  // Read dimensions and buffer for each PNG file
  const boxes: FontBox[] = []
  
  for (const filename of pngFiles) {
    const filePath = join(pngDir, filename)
    try {
      const buffer = await sharp(filePath).png().toBuffer()
      const metadata = await sharp(buffer).metadata()
      
      if (metadata.width && metadata.height) {
        boxes.push({
          w: metadata.width,
          h: metadata.height,
          filename,
          buffer
        })
      }
    } catch (error) {
      console.error(`❌ Error processing ${filename}:`, error)
    }
  }
  
  console.log(`✅ Successfully processed ${boxes.length} images`)
  
  // Use potpack to calculate optimal layout
  console.log('🎯 Calculating optimal layout with potpack...')
  const result = potpack(boxes)
  
  console.log(`📐 Canvas dimensions: ${result.w} x ${result.h}`)
  console.log(`📦 Fill ratio: ${(result.fill * 100).toFixed(1)}%`)
  
  // Create the composite image
  console.log('🎨 Creating composite AVIF image (can take up to 5 minutes)...')
  
  // Create a transparent background canvas
  const canvas = sharp({
    create: {
      width: result.w,
      height: result.h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  
  // Prepare composite operations for all positioned images
  const compositeOps = boxes.map(box => ({
    input: box.buffer,
    top: box.y!,
    left: box.x!
  }))
  
  // Create AVIF composite directly
  const avifOutputPath = join(process.cwd(), 'output', 'font-bundle.avif')
  await canvas
    .composite(compositeOps)
    .avif({ quality: 85 })
    .toFile(avifOutputPath)
  
  console.log(`🎉 Font bundle AVIF created successfully at: ${avifOutputPath}`)
  console.log(`📏 Final dimensions: ${result.w} x ${result.h} pixels`)
  
  // Create minimal font metadata JSON
  console.log('📝 Generating minimal font metadata JSON...')
  
  const fontMetadata: FontMetadata[] = boxes.map(box => ({
    n: box.filename.replace('.png', ''),
    x: box.x!,
    y: box.y!,
    w: box.w,
    h: box.h
  }))
  
  // Sort by font name for better organization
  fontMetadata.sort((a, b) => a.n.localeCompare(b.n))
  
  // Write the minimal JSON file
  const jsonOutputPath = join(process.cwd(), 'output', 'font-bundle.json')
  
  // Format JSON with one font per line
  const jsonLines = fontMetadata.map(font => JSON.stringify(font))
  const compactJson = '[\n' + jsonLines.join(',\n') + '\n]'
  
  await writeFile(jsonOutputPath, compactJson, 'utf8')
  
  console.log(`📄 Minimal font metadata JSON created at: ${jsonOutputPath}`)
  
  return {
    width: result.w,
    height: result.h,
    totalImages: boxes.length,
    fillRatio: result.fill,
    avifOutputPath,
    jsonOutputPath
  }
}

createFontBundle()
  .then(result => console.log('✨ Bundle creation completed:', result))
  .catch(error => {
    console.error('💥 Error creating font bundle:', error)
    process.exit(1)
  })
