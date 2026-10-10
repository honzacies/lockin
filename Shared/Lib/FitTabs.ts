/**
 * Šířky tabů, když se nevejdou: ubírá se postupně zleva (nejstarší taby),
 * každý jen do `min`, aktivní tab se nezmenšuje nikdy. Co se nevejde ani
 * potom, řeší scroll lišty.
 */
export function FitTabs(natural: number[], activeIndex: number, available: number, min: number): number[] {
  const widths = [...natural];
  let excess = widths.reduce((sum, w) => sum + w, 0) - available;
  for (let i = 0; i < widths.length && excess > 0; i++) {
    if (i === activeIndex) continue;
    const cut = Math.min(excess, Math.max(0, widths[i] - min));
    widths[i] -= cut;
    excess -= cut;
  }
  return widths;
}
