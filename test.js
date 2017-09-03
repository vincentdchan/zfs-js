const zfs = require('./index.js');

zfs.connect("test.disk");

let fd;
let buf1 = Buffer.from([1,2,3,4]);

// fd = zfs.open('/test.txt', zfs.ZFILE_FLAG_WRITE);
// zfs.write(fd, buf1, 0, 4);
// zfs.write(fd, buf1, 0, 4);
// zfs.seek(fd, 0);
// let buf2 = Buffer.alloc(8);
// zfs.read(fd, buf2, 0, 8);
// console.log(buf2);

// zfs.close(fd);

// zfs.createdir('/home');

zfs.remove('/home/cdz.txt');
console.log(zfs.stat('/home'));
console.log(zfs.listdir('/home'));
// fd = zfs.open('/home/cdz.txt', zfs.ZFILE_FLAG_WRITE);
// zfs.write(fd, buf1, 0, 4);

zfs.close(fd);

zfs.disconnect();
