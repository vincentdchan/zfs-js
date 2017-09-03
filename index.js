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

function findHandle() {
    let result = 0;
    while (openedFileHandles[result] !== undefined) {
        result++;
    }
    return result;
}

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
    return {
        struct: childDirStruct,
        number: child.number,
    }
}

function getFatherDirStruct(slices) {
    let blocknum = 1;
    let dirStruct = dirstruct.readDirStructFromDisk(FileDiskHandle, blocknum * BLOCK_SIZE);
    if (slices.length > 1) {
        let dirSlices = slices.slice(0, slices.length - 1);
        for (let i = 0; i < dirSlices.length; i++) {
            let currentDirName = dirSlices[i];
            let nextDirStructResult = findChildDirStructFromDirStruct(dirStruct, currentDirName);
            if (nextDirStructResult === null) {
                throw new Error("'" + currentDirName + "'" + " doesn't exist.");
            }
            dirStruct = nextDirStructResult.struct;
            blocknum = nextDirStructResult.number;
        }
    }
    return {
        struct: dirStruct,
        number: blocknum,
    };
}

exports.disconnect = () => {
    fs.closeSync(FileDiskHandle);
}

exports.open = (filename, flag) => {
    if (filename[0] != '/') {
        throw new Error("The path must starts with '/'");
    }
    let slices = filename.split('/').slice(1);  // slice and remove the first element
    let realname = slices[slices.length - 1];
    let fatherResult = getFatherDirStruct(slices);
    let dirItem = findChildFromDirStruct(fatherResult.struct, realname);
    if (dirItem === null) {
        // file not exists
        if (flag & ZFILE_FLAG_WRITE) { // create the file
            dirItem = new dirstruct.DirItem();
            dirItem.name = realname;
            dirItem.created_time = new Date().getTime();
            dirItem.edited_time = new Date().getTime();

            fatherResult.struct.data.push(dirItem);
            dirstruct.writeDirStructToDisk(FileDiskHandle, fatherResult.number * BLOCK_SIZE, fatherResult.struct);
        } else {
            throw new Error("file not exists");
        }
    } 
    let handle = findHandle();
    let openedfile = new OpenedFile.OpenedFile();
    openedfile.filename = filename;
    openedfile.flag = flag;
    openedFileHandles[handle] = openedfile
    return handle;
}

exports.close = (handle) => {
    openedFileHandles[handle] = undefined;
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
