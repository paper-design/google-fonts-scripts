// Common axes sorting order, used to display axes in a consistent manner
// when generating labels for variable fonts and in the axes popover
const AXES_SORT_ORDER = ['wght', 'wdth', 'ital', 'slnt', 'opsz'];

export function sortAxes(a: string, b: string) {
  const aIndex = AXES_SORT_ORDER.indexOf(a.toLowerCase());
  const bIndex = AXES_SORT_ORDER.indexOf(b.toLowerCase());

  // Both axes are in the common list
  if (aIndex !== -1 && bIndex !== -1) {
    return aIndex - bIndex;
  }
  // Only one of the two is in the common list
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;

  // Fallback to alphabetical
  return a.localeCompare(b);
}
