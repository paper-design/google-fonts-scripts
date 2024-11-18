export async function fetchGoogleFonts(): Promise<google.fonts.WebfontFamily[]> {
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.GOOGLE_FONTS_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('Expected items to be an array');
  return data.items;
}
