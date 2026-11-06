const belowTwenty = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

const underHundred = (n) => (n < 20 ? belowTwenty[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${belowTwenty[n % 10]}` : ''}`);

const underThousand = (n) => {
  if (!n) return '';
  if (n < 100) return underHundred(n);
  const rest = n % 100;
  return `${belowTwenty[Math.floor(n / 100)]} HUNDRED${rest ? ` AND ${underHundred(rest)}` : ''}`;
};

// Whole rupees, Indian system. Keep identical to client/src/utils/amountInWords.js.
const amountInWords = (amount) => {
  let remaining = Math.round(Number(amount) || 0);
  if (remaining === 0) return 'ZERO RUPEES ONLY';
  const parts = [];
  for (const [value, label] of [[10000000, 'CRORE'], [100000, 'LAKH'], [1000, 'THOUSAND']]) {
    if (remaining >= value) {
      parts.push(`${underThousand(Math.floor(remaining / value))} ${label}`);
      remaining %= value;
    }
  }
  if (remaining) parts.push(remaining < 100 && parts.length ? `AND ${underHundred(remaining)}` : underThousand(remaining));
  return `${parts.join(' ')} RUPEES ONLY`;
};

module.exports = { amountInWords };
