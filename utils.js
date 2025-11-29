function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const sampleSize = (arr, n = 1) => {
  let m = arr.length;
  while (m) {
    const i = Math.floor(Math.random() * m--);
    [arr[m], arr[i]] = [arr[i], arr[m]];
  }
  return arr.slice(0, n);
};

const majority = (arr) => {
  const threshold = Math.floor(arr.length / 2);
  const map = {};
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i];
    map[value] = map[value] + 1 || 1;
    if (map[value] > threshold) return value;
  }
  return false;
};

module.exports = {
  makeid,
  sampleSize,
  majority,
};
