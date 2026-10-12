const belowTwenty = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

const underThousand = (number) => {
  const n = Math.floor(number);
  if (!n) return '';
  if (n < 20) return belowTwenty[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${belowTwenty[n % 10]}` : ''}`;
  return `${belowTwenty[Math.floor(n / 100)]} HUNDRED${n % 100 ? ` ${underThousand(n % 100)}` : ''}`;
};

const amountInWords = (amount) => {
  let remaining = Math.round(Number(amount) || 0);
  if (remaining === 0) return 'ZERO RUPEES ONLY';
  const parts = [];
  const scales = [[10000000, 'CRORE'], [100000, 'LAKH'], [1000, 'THOUSAND']];
  for (const [value, label] of scales) {
    if (remaining >= value) {
      parts.push(`${underThousand(Math.floor(remaining / value))} ${label}`);
      remaining %= value;
    }
  }
  if (remaining) parts.push(underThousand(remaining));
  return `${parts.join(' ')} RUPEES ONLY`;
};

module.exports = { amountInWords };
