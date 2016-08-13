export const reverseKeys = (object) => {
  const keys = Object.keys(object).reverse();
  var newObject = {};
  
  keys.forEach(k => newObject[k] = object[k]);
  
  return newObject;
};

export const getTimeHash = () => {
  const d = new Date();
  const methods = ['getFullYear', 'getMonth', 'getDate', 'getHours', 'getMinutes', 'getSeconds'];
  
  var result = '';
  
  methods.forEach(m => {
    var str = d[m]();
    
    if(m === 'getMonth') str += 1;
    
    str = String(str);
    
    if(str.length === 1) str = "0" + str;
    
    result = result + str;
  });
  
  return result;
};