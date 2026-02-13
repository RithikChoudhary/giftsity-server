/**
 * Indian state name normalization for Shiprocket API compatibility.
 * Shiprocket requires full canonical state names (e.g. "Maharashtra", not "MH").
 */

const STATE_MAP = {
  // Full names (canonical) — mapped to themselves for lookup
  'andhra pradesh': 'Andhra Pradesh',
  'arunachal pradesh': 'Arunachal Pradesh',
  'assam': 'Assam',
  'bihar': 'Bihar',
  'chhattisgarh': 'Chhattisgarh',
  'goa': 'Goa',
  'gujarat': 'Gujarat',
  'haryana': 'Haryana',
  'himachal pradesh': 'Himachal Pradesh',
  'jharkhand': 'Jharkhand',
  'karnataka': 'Karnataka',
  'kerala': 'Kerala',
  'madhya pradesh': 'Madhya Pradesh',
  'maharashtra': 'Maharashtra',
  'manipur': 'Manipur',
  'meghalaya': 'Meghalaya',
  'mizoram': 'Mizoram',
  'nagaland': 'Nagaland',
  'odisha': 'Odisha',
  'punjab': 'Punjab',
  'rajasthan': 'Rajasthan',
  'sikkim': 'Sikkim',
  'tamil nadu': 'Tamil Nadu',
  'telangana': 'Telangana',
  'tripura': 'Tripura',
  'uttar pradesh': 'Uttar Pradesh',
  'uttarakhand': 'Uttarakhand',
  'west bengal': 'West Bengal',

  // Union territories
  'andaman and nicobar islands': 'Andaman and Nicobar Islands',
  'andaman & nicobar islands': 'Andaman and Nicobar Islands',
  'andaman and nicobar': 'Andaman and Nicobar Islands',
  'chandigarh': 'Chandigarh',
  'dadra and nagar haveli and daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'dadra & nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman & diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'delhi': 'Delhi',
  'new delhi': 'Delhi',
  'jammu and kashmir': 'Jammu and Kashmir',
  'jammu & kashmir': 'Jammu and Kashmir',
  'ladakh': 'Ladakh',
  'lakshadweep': 'Lakshadweep',
  'puducherry': 'Puducherry',
  'pondicherry': 'Puducherry',

  // Common abbreviations
  'ap': 'Andhra Pradesh',
  'ar': 'Arunachal Pradesh',
  'as': 'Assam',
  'br': 'Bihar',
  'ct': 'Chhattisgarh',
  'cg': 'Chhattisgarh',
  'ga': 'Goa',
  'gj': 'Gujarat',
  'hr': 'Haryana',
  'hp': 'Himachal Pradesh',
  'jh': 'Jharkhand',
  'jk': 'Jammu and Kashmir',
  'ka': 'Karnataka',
  'kl': 'Kerala',
  'mp': 'Madhya Pradesh',
  'mh': 'Maharashtra',
  'mn': 'Manipur',
  'ml': 'Meghalaya',
  'mz': 'Mizoram',
  'nl': 'Nagaland',
  'or': 'Odisha',
  'od': 'Odisha',
  'pb': 'Punjab',
  'rj': 'Rajasthan',
  'sk': 'Sikkim',
  'tn': 'Tamil Nadu',
  'tg': 'Telangana',
  'ts': 'Telangana',
  'tr': 'Tripura',
  'up': 'Uttar Pradesh',
  'uk': 'Uttarakhand',
  'ua': 'Uttarakhand',
  'wb': 'West Bengal',
  'an': 'Andaman and Nicobar Islands',
  'ch': 'Chandigarh',
  'dn': 'Dadra and Nagar Haveli and Daman and Diu',
  'dd': 'Dadra and Nagar Haveli and Daman and Diu',
  'dl': 'Delhi',
  'la': 'Ladakh',
  'ld': 'Lakshadweep',
  'py': 'Puducherry',

  // Common misspellings / alternate forms
  'orissa': 'Odisha',
  'chattisgarh': 'Chhattisgarh',
  'chhatisgarh': 'Chhattisgarh',
  'tamilnadu': 'Tamil Nadu',
  'tamil-nadu': 'Tamil Nadu',
  'andhrapradesh': 'Andhra Pradesh',
  'andhra-pradesh': 'Andhra Pradesh',
  'madhyapradesh': 'Madhya Pradesh',
  'madhya-pradesh': 'Madhya Pradesh',
  'uttarpradesh': 'Uttar Pradesh',
  'uttar-pradesh': 'Uttar Pradesh',
  'himachalpradesh': 'Himachal Pradesh',
  'himachal-pradesh': 'Himachal Pradesh',
  'arunachalpradesh': 'Arunachal Pradesh',
  'arunachal-pradesh': 'Arunachal Pradesh',
  'westbengal': 'West Bengal',
  'west-bengal': 'West Bengal',
  'j&k': 'Jammu and Kashmir',
  'j & k': 'Jammu and Kashmir',
};

/**
 * Normalize a state name/abbreviation to the canonical full name Shiprocket expects.
 * Returns the canonical name if found, or the original input (trimmed, title-cased) if not recognized.
 */
function normalizeState(input) {
  if (!input || typeof input !== 'string') return input;
  const trimmed = input.trim();
  const key = trimmed.toLowerCase();
  if (STATE_MAP[key]) return STATE_MAP[key];
  // If not found, return the original with first-letter capitalization as a best guess
  return trimmed.replace(/\b\w/g, c => c.toUpperCase());
}

module.exports = { normalizeState, STATE_MAP };
