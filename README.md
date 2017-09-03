
# ZFS 

ZFS(Z FileSystem) is a virtual disk implementation for a CS homework.
It approximately implements a FAT file system in a single file.
This repo is implemented in NodeJS. The API is Unix style.

# Example

```javascript
const zfs = require('zfs-js');

zfs.connect('virtualdisk.disk');

const fd = zfs.open('/test.txt', zfs.ZFILE_FLAG_WRITE);

let buf = Buffer.from([0, 1, 2, 3, 4]);
zfs.write(zfs, buf, 0, 5);

zfs.close(fd);

zfs.disconnect();
```