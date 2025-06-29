import { useEffect, useRef, useState } from 'react';

type Font = {
  name: string;
  chunk: number;
  x: number;
  y: number;
  width: number;
  styles: string[];
  noPreview?: boolean;
};

type AllFonts = {
  fonts: {
    [fontName: string]: {
      ch: number;
      x: number;
      y: number;
      w: number;
      s: string[];
      noPreview?: boolean;
    };
  };
  chunks: { w: number; h: number }[];
};

const FONT_HEIGHT_IN_CHUNK = 32;
const FONT_PREVIEW_HEIGHT = 16;
const SCALE = 0.5;

const useIntersectionObserver = () => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver((entries) => setIsVisible(entries[0].isIntersecting), {
      rootMargin: '2000px',
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
};

const FontPreview = ({ font, chunks }: { font: Font; chunks: { w: number; h: number }[] }) => {
  if (font.noPreview) {
    return (
      <div
        className="text-sm text-gray-700 truncate pr-2"
        style={{ height: `${FONT_PREVIEW_HEIGHT}px`, lineHeight: `${FONT_PREVIEW_HEIGHT}px` }}
      >
        {font.name}
      </div>
    );
  }

  const chunk = chunks[font.chunk];
  const chunkUrl = `/font-chunks/v1/font-chunk-${font.chunk}.avif`;

  if (!chunk) return null;

  const width = Math.round((font.width / FONT_HEIGHT_IN_CHUNK) * FONT_PREVIEW_HEIGHT);

  return (
    <div
      className="bg-no-repeat"
      style={{
        width: `${width}px`,
        height: `${FONT_PREVIEW_HEIGHT}px`,
        backgroundImage: `url(${chunkUrl})`,
        backgroundSize: `${chunk.w * SCALE}px ${chunk.h * SCALE}px`,
        backgroundPosition: `-${font.x * SCALE}px -${font.y * SCALE}px`,
      }}
    />
  );
};

const FontContainer = ({ font, chunks }: { font: Font; chunks: { w: number; h: number }[] }) => {
  const { ref, isVisible } = useIntersectionObserver();

  const handleClick = () => {
    alert(`Font: ${font.name}\nWeights: ${font.styles.join(', ')}`);
  };

  return (
    <div ref={ref} className="w-[289px] h-9 flex items-center pl-2.5 hover:bg-gray-300" onClick={handleClick}>
      {isVisible && <FontPreview font={font} chunks={chunks} />}
    </div>
  );
};

const FontBundleViewer = () => {
  const [fontBundle, setFontBundle] = useState<Font[]>([]);
  const [chunks, setChunks] = useState<{ w: number; h: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchFonts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/font-chunks/v1/fonts.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch fonts.json: ${response.statusText}`);
        }
        const data: AllFonts = await response.json();

        // Convert object to array and add font names
        const fontArray: Font[] = Object.entries(data.fonts).map(([fontName, fontData]) => ({
          name: fontName,
          chunk: fontData.ch,
          x: fontData.x,
          y: fontData.y,
          width: fontData.w,
          styles: fontData.s,
          noPreview: fontData.noPreview,
        }));

        setFontBundle(fontArray);
        setChunks(data.chunks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchFonts();
  }, []);

  useEffect(() => {
    if (fontBundle.length === 0) return;

    // Get unique chunk numbers and preload images
    const uniqueChunks = Array.from(new Set(fontBundle.map((font) => font.chunk)));
    const preloadImages = uniqueChunks.map((chunkNum) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load font-chunk-${chunkNum}.avif`));
        img.src = `/font-chunks/v1/font-chunk-${chunkNum}.avif`;
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
  }, [fontBundle]);

  if (loading) {
    return <div className="p-5">Loading fonts...</div>;
  }

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
            <FontContainer key={index} font={font} chunks={chunks} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FontBundleViewer;
