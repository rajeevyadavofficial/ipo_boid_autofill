/**
 * Simple Nepali Date Converter (BS <-> AD)
 * Covers BS Years 2070 to 2090
 */

const bsMonthDays = {
  2070: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2074: [31, 31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 31],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 29, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 31],
  2079: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 29, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 29, 31],
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 29, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2085: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 29, 31],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 29, 30],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2089: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [31, 31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 31],
};

const epochAD = new Date(2013, 3, 14); // 2070-01-01 BS is 2013-04-14 AD
const epochBSYear = 2070;

export const bsToAd = (year, month, day) => {
  if (year < 2070 || year > 2090) return null;
  
  let totalDays = 0;
  
  // Days from 2070 up to current year
  for (let y = epochBSYear; y < year; y++) {
    totalDays += bsMonthDays[y].reduce((a, b) => a + b, 0);
  }
  
  // Days from months in current year
  for (let m = 0; m < month - 1; m++) {
    totalDays += bsMonthDays[year][m];
  }
  
  totalDays += (day - 1);
  
  const resultAD = new Date(epochAD);
  resultAD.setDate(resultAD.getDate() + totalDays);
  
  return resultAD;
};

export const adToBs = (adDate) => {
  let diff = Math.floor((adDate - epochAD) / (1000 * 60 * 60 * 24));
  
  if (diff < 0) return null;
  
  let currentYear = epochBSYear;
  let currentMonth = 1;
  
  while (diff >= bsMonthDays[currentYear].reduce((a, b) => a + b, 0)) {
    diff -= bsMonthDays[currentYear].reduce((a, b) => a + b, 0);
    currentYear++;
    if (!bsMonthDays[currentYear]) return null;
  }
  
  for (let m = 0; m < 12; m++) {
    const daysInMonth = bsMonthDays[currentYear][m];
    if (diff < daysInMonth) {
      currentMonth = m + 1;
      break;
    }
    diff -= daysInMonth;
  }
  
  return {
    year: currentYear,
    month: currentMonth,
    day: diff + 1
  };
};

export const nepaliMonths = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

export const englishMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
