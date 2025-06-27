# google-fonts-scripts

This repository downloads Google Fonts data, generates preview images for each font, and combines all the font previews into small chunk images.

### Instructions

Make sure to add a Google Fonts API key in a .env file as `GOOGLE_FONTS_API_KEY`. You can get one for free here: https://developers.google.com/fonts/docs/developer_api

We commit the output directory because we only generate new PNGs if they're not yet generated. `metadata.json` will be regenerated each time.

```bash
# install deps
bun install

# run all scripts
bun all

# check output folder
```

`bun all` will run `bun metadata`, `bun png`, and `bun packing`.


### Output

#### Metadata

`bun metadata` generates `output/metadata.json`:

```ts
{
  'ABeeZee': ['400', '400i'],
  'Abhaya Libre': ['400', '500', '600', '700', '800'],
  // etc
};
```

#### PNG previews

`bun png` generates PNG files:

```
/output/png/abeezee.png
/output/png/abhaya-libre.png
...etc
```

#### SVG previews

`bun png` generates SVG files:

```
/output/svg/abeezee.svg
/output/svg/abhaya-libre.svg
... etc
```

> [!NOTE]
> SVG previews are currently unused.

#### Families to skip

If any font family is problematic or doesn't generate an English preview, add it to `src/families-to-skip.ts`.


#### Packing

For performance reasons, instead of loading individual font previews or one huge font preview bundle image at runtime, we combine font previews and split them into chunks.

Once you have individual `/output/png/` files and `/output/metadata.json`, you can run `bun packing` to generate in `/output/font-chunks/`:

- 35+ chunks containing 50 font previews each
- `fonts.json` which contains metadata about fonts and the chunks

These are the only files you need to create the font picker.

### Demo

To see a font picker demo with the fonts you just packed:
- Copy the content of `/output/font-chunks/`  into `/example/public/v1/`
- In `/example`, run: `bun i` and `bun dev`

### Versioning

To avoid browser caching issues when generating new chunks for production, put the new chunks in a new `public` folder, such as `/public/font-chunks/v2/*` and update the path in the code.

### Prior art

- [google-font-to-svg-path](https://github.com/danmarshall/google-font-to-svg-path) inspired the makerjs usage
- Figma inspired storing previews as SVGs
