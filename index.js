/************************ 
 * Author: DZ Chan 
 * Date:   2017-09-02 
 ************************/ 

const fs = require("fs");
const BLOCK_SIZE = 4 * 1024;
const BLOCK_NUM = 256
const FILEDISK_SIZE = BLOCK_NUM * BLOCK_SIZE;

let FATBuffer = [];
let FileDiskHandle;

for (let i = 0; i < BLOCK_NUM; i++) {
    FATBuffer.push(0);
}

FATBuffer[0] = 1;
FATBuffer[1] = -1;

function ReadFAT(fd, fatBuffer) {
    let bytesNumber = 256 * 2;
    let buffer = Buffer.alloc(bytesNumber);
    let offset = 0;
    while (offset < bytesNumber) {
        offset += fs.readSync(FileDiskHandle, buffer, offset, bytesNumber - offset, offset);
    }
}

function WriteFAT(fd, fatBuffer) {
    let bytesNumber = 256 * 2;
    let buffer = Buffer.alloc(bytesNumber);
    for (let i = 0; i < 256; i++) {
        buffer.writeInt16BE(FATBuffer[i], i * 2, true);
    }
    let offset = 0;
    while (offset < bytesNumber) {
        offset += fs.writeSync(FileDiskHandle, buffer, offset, bytesNumber - offset, offset);
    }
}

exports.connect = (filedisk) => {
    if (fs.existsSync(filedisk)) {
        FileDiskHandle = fs.openSync(filedisk, 'r+');
        ReadFAT(FileDiskHandle, FATBuffer);
    } else {
        // file not exist
        // make a 2M null file
        FileDiskHandle = fs.openSync(filedisk, 'w+');
        let buffer = Buffer.alloc(256);
        for (let i = 0; i < FILEDISK_SIZE / 256; i++) {
            fs.writeFileSync(FileDiskHandle, buffer);
            fs.writeSync(FileDiskHandle, buffer, 0, 256, i * 256);
        }
        WriteFAT(FileDiskHandle, FATBuffer);
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

exports.getFATValue = (index) => {
    return FATBuffer[index];
}
