import { quicktype, jsonInputForTargetLanguage, InputData } from 'quicktype-core';
import { fetchGoogleFontsMeta, fetchGoogleFontsVariable } from './fetch-google-fonts';

const [fontsVariable, metadata] = await Promise.all([fetchGoogleFontsVariable(), fetchGoogleFontsMeta()]);

const jsonInput = jsonInputForTargetLanguage('typescript');

await jsonInput.addSource({
  name: 'GoogleFontsVariable',
  samples: [JSON.stringify(fontsVariable)],
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
