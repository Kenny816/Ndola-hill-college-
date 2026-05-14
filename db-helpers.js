/**
 * Convert an object's keys to lowercase (recursively for simple objects).
 */
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

module.exports = { toLowerKeys };
