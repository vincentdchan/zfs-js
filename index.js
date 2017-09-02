/************************ 
 * Author: DZ Chan 
 * Date:   2017-09-02 
 ************************/ 

const fs = require("fs");
const dirstruct = require("./dirstruct");
const OpenedFile = require('./openedfile');

const BLOCK_SIZE = 4 * 1024;
const BLOCK_NUM = 256
const FILEDISK_SIZE = BLOCK_NUM * BLOCK_SIZE;

const ZFILE_FLAG_READ = 0x1;
const ZFILE_FLAG_WRITE = 0x2;
const ZFILE_FLAG_APPEND = 0x4;

const ZFILE_TYPE_FILE = 0x1;
const ZFILE_TYPE_DIR = 0x2;

let FATBuffer = [];
let FileDiskHandle;

let openedFileHandles = [];
openedFileHandles.length = 128;

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

function findChildFromDirStruct(father, children_name) {
    for (let i = 0; i < father.length; i++) {
        let item = father.data[i];
        if (item.name == children_name) {
            return item;
        }
    }
    return null;
}

function findChildDirStructFromDirStruct(father, children_name) {
    let child = findChildFromDirStruct(father, children_name);
    if (child === null) return null;
    if (child.type !== ZFILE_TYPE_DIR ) {
        throw new Error("target is not a dir");
    }
    let childDirStruct = dirstruct.readDirStructFromDisk(FileDiskHandle, child.number * BLOCK_SIZE);
    return childDirStruct;
}

function getFatherDirStruct(slices) {
    let dirStruct = dirstruct.readDirStructFromDisk(FileDiskHandle, 1 * BLOCK_SIZE);
    if (slices.length > 1) {
        let dirSlices = slices.slice(0, slices.length - 1);
        for (let i = 0; i < dirSlices.length; i++) {
            let currentDirName = dirSlices[i];
            let nextDirStruct = findChildDirStructFromDirStruct(dirStruct, currentDirName);
            if (nextDirStruct === null) {
                throw new Error("'" + currentDirName + "'" + " doesn't exist.");
            }
            dirStruct = nextDirStruct;
        }
    }
    return dirStruct;
}

exports.disconnect = () => {
    fs.closeSync(FileDiskHandle);
}

exports.open = (filename, flag) => {
    if (filename[0] != '/') {
        throw new Error("The path must starts with '/'");
    }
    let slices = filename.split('/').slice(1);  // slice and remove the first element
    let father = getFatherDirStruct(slices);
    return 0;
}

exports.read = () => {
    return 0;
}

exports.remove = (filename) => {

}

exports.getFATValue = (index) => {
    return FATBuffer[index];
}

exports.ZFILE_FLAG_READ = ZFILE_FLAG_READ;
exports.ZFILE_FLAG_WRITE = ZFILE_FLAG_WRITE;
exports.ZFILE_FLAG_APPEND = ZFILE_FLAG_APPEND;
