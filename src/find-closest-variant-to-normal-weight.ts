/** Finds the closest non-italic variant to 400 */
export function findClosestVariantToNormalWeight(variants: string[]): string {
  const normalVariants = variants.filter((v) => !v.includes('italic'));
  if (normalVariants.length === 0) return variants[0];

  const weights = normalVariants.map((v) => {
    const weight = parseInt(v) || (v === 'regular' ? 400 : 0);
    return { variant: v, weight, diff: Math.abs(weight - 400) };
  });

  weights.sort((a, b) => a.diff - b.diff);
  return weights[0].variant;
}
