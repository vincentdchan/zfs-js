const zfs = require('./index.js');

zfs.connect("test.disk");
console.log(zfs.open());
console.log(zfs.read());
zfs.disconnect();
