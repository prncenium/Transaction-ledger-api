export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function formatINR(paise) {
  const rupees = Number(paise) / 100;
  return rupees.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
