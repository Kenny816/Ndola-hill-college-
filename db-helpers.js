function toLowerKeys(obj) {
  if (Array.isArray(obj)) return obj.map(toLowerKeys);
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key.toLowerCase()] = toLowerKeys(obj[key]);
    }
    return newObj;
  }
  return obj;
}

const settingsKeyMap = {
  id: 'id',
  collegename: 'collegeName',
  motto: 'motto',
  vision: 'vision',
  email: 'email',
  phone: 'phone',
  address: 'address',
  logo: 'logo',
  headerbg: 'headerBg',
  herobg: 'heroBg',
  herocolor: 'heroColor',

  trustbadge1: 'trustBadge1',
  trustbadge2: 'trustBadge2',
  trustbadge3: 'trustBadge3',
  trustbadge4: 'trustBadge4',
  alloweduploadformats: 'allowedUploadFormats',
  alloweddownloadformats: 'allowedDownloadFormats',
  partners: 'partners',
  gallery: 'gallery',
stat_graduates: 'statGraduates',
  stat_employment_rate: 'statEmploymentRate',
  stat_jobs: 'statJobs',
  stat_programmes: 'statProgrammes',,
primarycolor: 'primaryColor',
  accentcolor: 'accentColor',
};

function settingsToCamel(obj) {
  if (!obj) return {};
  const result = {};
  for (const key in obj) {
    result[settingsKeyMap[key] || key] = obj[key];
  }
  return result;
}

module.exports = { toLowerKeys, settingsToCamel };
