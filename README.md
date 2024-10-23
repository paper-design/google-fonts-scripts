# google-fonts-scripts

### Output:

#### Minimal JSON data about Google fonts

```ts
// /output/raw-font-data.json
[
  { family: 'ABeeZee', variants: ['400', '400i'] },
  { family: 'Abhaya Libre', variants: ['400', '500', '600', '700', '800'] },
  // etc
];
```

#### SVG previews of each font

Each SVG uses the font's own name as its preview text.

```
/output/svg/abeezee.svg
/output/svg/abhaya-libre.svg
... etc
```

### Instructions

We commit the output directory because we only generate new SVGs if they're not yet generated. `raw-font-data.json` will be regenerated each time.

```bash
# install deps
bun install

# run
bun run generate
# check output folder
```

### Prior art

- [google-font-to-svg-path](https://github.com/danmarshall/google-font-to-svg-path) inspired the makerjs usage
- Figma inspired storing previews as SVGs
