import { useEffect, useRef, useState } from 'react';

import chunk1 from '../fonts/chunks/font-chunk-1.avif';
import chunk2 from '../fonts/chunks/font-chunk-2.avif';
import chunk3 from '../fonts/chunks/font-chunk-3.avif';
import chunk4 from '../fonts/chunks/font-chunk-4.avif';
import chunk5 from '../fonts/chunks/font-chunk-5.avif';
import chunk6 from '../fonts/chunks/font-chunk-6.avif';
import chunk7 from '../fonts/chunks/font-chunk-7.avif';
import chunk8 from '../fonts/chunks/font-chunk-8.avif';
import chunk9 from '../fonts/chunks/font-chunk-9.avif';
import chunk10 from '../fonts/chunks/font-chunk-10.avif';
import chunk11 from '../fonts/chunks/font-chunk-11.avif';
import chunk12 from '../fonts/chunks/font-chunk-12.avif';
import chunk13 from '../fonts/chunks/font-chunk-13.avif';
import chunk14 from '../fonts/chunks/font-chunk-14.avif';
import chunk15 from '../fonts/chunks/font-chunk-15.avif';
import chunk16 from '../fonts/chunks/font-chunk-16.avif';
import chunk17 from '../fonts/chunks/font-chunk-17.avif';
import chunk18 from '../fonts/chunks/font-chunk-18.avif';
import chunk19 from '../fonts/chunks/font-chunk-19.avif';
import chunk20 from '../fonts/chunks/font-chunk-20.avif';
import chunk21 from '../fonts/chunks/font-chunk-21.avif';
import chunk22 from '../fonts/chunks/font-chunk-22.avif';
import chunk23 from '../fonts/chunks/font-chunk-23.avif';
import chunk24 from '../fonts/chunks/font-chunk-24.avif';
import chunk25 from '../fonts/chunks/font-chunk-25.avif';
import chunk26 from '../fonts/chunks/font-chunk-26.avif';
import chunk27 from '../fonts/chunks/font-chunk-27.avif';
import chunk28 from '../fonts/chunks/font-chunk-28.avif';
import chunk29 from '../fonts/chunks/font-chunk-29.avif';
import chunk30 from '../fonts/chunks/font-chunk-30.avif';
import chunk31 from '../fonts/chunks/font-chunk-31.avif';
import chunk32 from '../fonts/chunks/font-chunk-32.avif';
import chunk33 from '../fonts/chunks/font-chunk-33.avif';

import fontBundle from '../fonts/fonts.json';

type Font = {
  n: string;
  ch: number;
  x: number;
  y: number;
  w: number;
  h: number;
  f: string[];
};

type ChunkInfo = {
  fonts: Font[];
  maxWidth: number;
  maxHeight: number;
};

const chunks = [
  chunk1,
  chunk2,
  chunk3,
  chunk4,
  chunk5,
  chunk6,
  chunk7,
  chunk8,
  chunk9,
  chunk10,
  chunk11,
  chunk12,
  chunk13,
  chunk14,
  chunk15,
  chunk16,
  chunk17,
  chunk18,
  chunk19,
  chunk20,
  chunk21,
  chunk22,
  chunk23,
  chunk24,
  chunk25,
  chunk26,
  chunk27,
  chunk28,
  chunk29,
  chunk30,
  chunk31,
  chunk32,
  chunk33,
];

const FontBundleViewer = () => {
  const [chunkInfo, setChunkInfo] = useState<Record<number, ChunkInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Preload all chunk images
  useEffect(() => {
    const preloadImages = chunks.map((chunk) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load ${chunk.src}`));
        img.src = chunk.src;
      });
    });

    Promise.allSettled(preloadImages).then((results) => {
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`Failed to preload ${failures.length} chunk images`);
      } else {
        console.log('All chunk images preloaded successfully');
      }
    });
  }, []);

  const loadFontBundle = async () => {
    try {
      // Group fonts by chunk to get chunk dimensions
      const chunkInfoData: Record<number, ChunkInfo> = {};
      fontBundle.forEach((font) => {
        if (!chunkInfoData[font.ch]) {
          chunkInfoData[font.ch] = {
            fonts: [],
            maxWidth: 0,
            maxHeight: 0,
          };
        }
        chunkInfoData[font.ch].fonts.push(font);

        // Calculate chunk canvas dimensions based on font positions
        const rightEdge = font.x + font.w;
        const bottomEdge = font.y + font.h;
        if (rightEdge > chunkInfoData[font.ch].maxWidth) {
          chunkInfoData[font.ch].maxWidth = rightEdge;
        }
        if (bottomEdge > chunkInfoData[font.ch].maxHeight) {
          chunkInfoData[font.ch].maxHeight = bottomEdge;
        }
      });

      setChunkInfo(chunkInfoData);
    } catch (err) {
      console.error('Error loading font bundle:', err);
      setError('Error loading font bundle');
    }
  };

  useEffect(() => {
    loadFontBundle();
  }, []);

  useEffect(() => {
    if (!scrollContainerRef.current || fontBundle.length === 0 || Object.keys(chunkInfo).length === 0) return;

    // Create a map to get font index from element
    const fontContainerElements = Array.from(scrollContainerRef.current.querySelectorAll('.font-container'));

    // Intersection Observer for toggling background-image
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const fontContainer = entry.target as HTMLDivElement;

          if (entry.isIntersecting) {
            // Find the font index based on the element position
            const fontIndex = fontContainerElements.indexOf(fontContainer);
            const font = fontBundle[fontIndex];

            if (font && chunkInfo[font.ch] && fontIndex >= 0) {
              // Create and add font-preview div when visible
              const fontPreview = document.createElement('div');
              fontPreview.className = 'font-preview';

              const standardHeight = 16;
              const aspectRatio = font.w / font.h;
              const standardWidth = Math.round(standardHeight * aspectRatio);
              const scale = standardHeight / font.h;

              // Get chunk canvas dimensions
              const chunkCanvasWidth = chunkInfo[font.ch].maxWidth;
              const chunkCanvasHeight = chunkInfo[font.ch].maxHeight;

              const chunkUrl = chunks[font.ch - 1].src;

              // Set all styles at once
              Object.assign(fontPreview.style, {
                width: `${standardWidth}px`,
                height: `${standardHeight}px`,
                backgroundImage: `url(${chunkUrl})`,
                backgroundSize: `${chunkCanvasWidth * scale}px ${chunkCanvasHeight * scale}px`,
                backgroundPosition: `-${font.x * scale}px -${font.y * scale}px`,
                backgroundRepeat: 'no-repeat',
              });

              fontContainer.appendChild(fontPreview);
            }
          } else {
            // Remove font-preview div when not visible to save memory
            const fontPreview = fontContainer.querySelector('.font-preview');
            if (fontPreview) {
              fontContainer.removeChild(fontPreview);
            }
          }
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '2000px',
      }
    );

    // Observe all font containers
    fontContainerElements.forEach((container) => {
      observerRef.current?.observe(container);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [fontBundle, chunkInfo]);

  if (error) {
    return <div className="p-5 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="font-sans m-0 p-5 bg-gray-100 h-dvh">
      <div
        ref={scrollContainerRef}
        className="h-[359px] w-[300px] overflow-y-auto overflow-x-hidden border border-gray-300 bg-gray-200 rounded"
      >
        <div className="flex flex-col">
          {fontBundle.map((font, index) => (
            <div
              key={index}
              className="font-container w-[289px] h-9 flex items-center pl-2.5 hover:bg-gray-300"
              onClick={() => {
                const fontName = font.n;
                const fontWeights = font.f.join(', ');
                alert(`Font: ${fontName}\nWeights: ${fontWeights}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FontBundleViewer;
