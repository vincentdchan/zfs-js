/************************ 
 * Author: DZ Chan 
 * Date:   2017-09-02 
 ************************/ 

const fs = require("fs");
const FAT_LENGTH = 256;
const FILEDISK_SIZE = 2 * 1024;

let FATBuffer = [];
let FileDiskHandle;

for (let i = 0; i < FAT_LENGTH; i++) {
    FATBuffer.push(0);
}

exports.connect = (filedisk) => {
    if (fs.existsSync(filedisk)) {
        FileDiskHandle = fs.openSync(filedisk, 'w+');
    } else {
        // file not exist
        // make a 2M null file
        FileDiskHandle = fs.openSync(filedisk, 'w+');
        let buffer = Buffer.alloc(256);
        for (let i = 0; i < 8; i++) {
            fs.writeFileSync(FileDiskHandle, buffer);
            fs.writeSync(FileDiskHandle, buffer, 0, 256, i * 256);
        }
    }
}

exports.disconnect = () => {
    fs.closeSync(FileDiskHandle);
}

exports.open = (filname) => {
    return 0;
}

exports.read = () => {
    return 0;
}
