const formatter = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function toCents(value) {
  return Number(formatter.format(value).replace(".", ""));
}
