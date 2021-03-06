const zfs = require('./index.js');

zfs.connect("test.disk");

let fd;
let buf1 = Buffer.from([10, 20, 30, 40, 50]);

// fd = zfs.open('/test.txt', zfs.ZFILE_FLAG_WRITE);
// zfs.write(fd, buf1, 0, 4);
// zfs.write(fd, buf1, 0, 4);
// zfs.seek(fd, 0);
// let buf2 = Buffer.alloc(8);
// zfs.read(fd, buf2, 0, 8);
// console.log(buf2);

// zfs.close(fd);

// zfs.createdir('/home');

// zfs.remove('/home/cdz.txt');
// console.log(zfs.stat('/home'));
// console.log(zfs.listdir('/home'));
fd = zfs.open('/zmy.txt', zfs.ZFILE_FLAG_WRITE);
zfs.writeAll(fd, buf1);
// let buf = zfs.readAll(fd);
// console.log("content:",  buf);
zfs.close(fd);

// zfs.remove('/zmy.txt')
console.log(zfs.listdir('/'))

zfs.disconnect();
