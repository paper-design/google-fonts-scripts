/**
 * Extracts OpenType features from the GSUB table
 *
 * We only want to extract names for stylistic sets and character variants,
 * names will be filled on Paper's side for registered features.
 *
 * We skip features that are not in the list of registered features.
 */
export function extractFeatures(font: opentype.Font): { tag: string; name?: string }[] {
  const features: { tag: string; name: string }[] = [];
  const names = font.names as any;

  const gsub = font.tables.gsub;

  // Extract feature tags from GSUB table
  // @TODO: store features in two arrays, one for the normal weights and one for the italic weights
  // See https://paper-design.slack.com/archives/C0A27B13N48/p1768931347862499?thread_ts=1768869978.138909&cid=C0A27B13N48
  if (gsub?.features) {
    for (const f of gsub.features) {
      const tag = f.tag;

      // Skip if already added
      if (features.some((f) => f.tag === tag)) {
        continue;
      }

      // Find the human-readable feature name
      let name;

      if (tag.startsWith('ss') || tag.startsWith('cv')) {
        // Stylistic sets (ss01 to ss20) use uiNameId
        // Character variants (cv01 to cv99) use featUiLabelNameId
        const uiNameId = f.feature.featureParamsTable?.uiNameId;
        const featUiLabelNameId = f.feature.featureParamsTable?.featUiLabelNameId;
        const id = uiNameId || featUiLabelNameId;

        if (id) {
          for (const platform in names) {
            const platformNames = names[platform as keyof typeof names];
            if (platformNames) {
              const n = platformNames[id];
              if (n) {
                // Use the English name, or the first available name
                name = n.en || Object.values(n)[0];
              }
              break;
            }
          }
        }
      }

      features.push({ tag, name });
    }
  }

  return features;
}
