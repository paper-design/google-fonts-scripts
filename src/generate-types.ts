import { quicktype, jsonInputForTargetLanguage, InputData } from 'quicktype-core';
import { fetchGoogleFontsMeta, fetchGoogleFonts } from './fetch-google-fonts';

const [fonts, metadata] = await Promise.all([fetchGoogleFonts(), fetchGoogleFontsMeta()]);

const jsonInput = jsonInputForTargetLanguage('typescript');

await jsonInput.addSource({
  name: 'GoogleFonts',
  samples: [JSON.stringify(fonts)],
});

await jsonInput.addSource({
  name: 'GoogleFontsMeta',
  samples: [JSON.stringify(metadata)],
});

const inputData = new InputData();
inputData.addInput(jsonInput);

const schema = await quicktype({
  inputData,
  lang: 'typescript',
});

await Bun.write('./__generated__/google-fonts.ts', schema.lines.join('\n'));
