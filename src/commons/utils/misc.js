
export function isObject (value) {
  return typeof value === 'object' && !Array.isArray(value) && value !== null;
}

export function stripProps (obj, blacklist) {
  blacklist = Array.isArray(blacklist) ? blacklist : (blacklist || []);
  const res = {};
  
  Object.keys(obj).forEach(prop => {
    if (blacklist.indexOf(prop) === -1) {
      const value = obj[prop];
      res[prop] = isObject(value) ? stripProps(value, blacklist) : value;
    }
  });
  
  return res;
}
