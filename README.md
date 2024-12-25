# google-fonts-scripts

At the moment, the SVG path generates the `/output/generated-font-data.json` file and the PNG path only generates PNGs.

If you want to use the AVIF path, you'll need `cargo` and `cavif` installed locally.

### Output:

#### Minimal JSON data about Google fonts

```ts
// /output/generated-font-data.json
{
  'ABeeZee': ['400', '400i'],
  'Abhaya Libre': ['400', '500', '600', '700', '800'],
  // etc
};
```

#### SVG previews of each font

Each SVG uses the font's own name as its preview text.

```
/output/svg/abeezee.svg
/output/svg/abhaya-libre.svg
... etc
```

#### PNG previews of each font

To run:

```
bun run generate-avif
```

Output:

```
/output/png/abeezee.svg
/output/png/abhaya-libre.svg
...etc
```

#### AVIF previews of each font

To run:

```
rustup update
cargo install cavif

bun run generate-avif
```

Output:

```
/output/avif/abeezee.svg
/output/avif/abhaya-libre.svg
...etc
```

### Instructions

Make sure to add a Google Fonts API key in a .env file as `GOOGLE_FONTS_API_KEY`. You can get one for free here: https://developers.google.com/fonts/docs/developer_api

We commit the output directory because we only generate new SVGs if they're not yet generated. `generated-font-data.json` will be regenerated each time.

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
