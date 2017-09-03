const zfs = require('./index.js');

zfs.connect("test.disk");
let fd = zfs.open('/test.txt', zfs.ZFILE_FLAG_WRITE);
console.log(zfs.read());
zfs.close(fd);
zfs.disconnect();
