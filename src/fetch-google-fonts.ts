import { type GoogleFonts, type GoogleFontsMeta, Convert } from '../__generated__/google-fonts';

const IGNORE_CONVERTING_RESPONSE = process.env.TYPEGEN;

export async function fetchGoogleFonts(): Promise<GoogleFonts> {
  const response = await fetch(
    `https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.GOOGLE_FONTS_API_KEY}`
  );

  if (IGNORE_CONVERTING_RESPONSE) {
    const data = await response.json();
    return data;
  } else {
    return Convert.toGoogleFonts(await response.text());
  }
}

export async function fetchGoogleFontsMeta(): Promise<GoogleFontsMeta> {
  const response = await fetch('https://fonts.google.com/metadata/fonts');

  if (IGNORE_CONVERTING_RESPONSE) {
    const data = await response.json();
    return data;
  } else {
    return Convert.toGoogleFontsMeta(await response.text());
  }
}
