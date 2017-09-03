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

const ZFILE_TYPE_FILE = 0x0;
const ZFILE_TYPE_DIR = 0x1;

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

function findNullFATBlockNum() {
    for (let i = 2; i < BLOCK_NUM; i++) {
        if (FATBuffer[i] === 0) {
            return i;
        }
    }
    return -1;
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
    let childDirStruct = dirstruct.readDirStructFromDisk(FileDiskHandle, child.begin_num * BLOCK_SIZE);
    return {
        struct: childDirStruct,
        number: child.begin_num,
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
            let beginBlockNum = findNullFATBlockNum();

            dirItem = new dirstruct.DirItem();
            dirItem.name = realname;
            dirItem.dir_num = fatherResult.number;
            dirItem.begin_num = beginBlockNum;
            dirItem.created_time = new Date().getTime();
            dirItem.edited_time = new Date().getTime();

            fatherResult.struct.data.push(dirItem);
            dirstruct.writeDirStructToDisk(FileDiskHandle, fatherResult.number * BLOCK_SIZE, fatherResult.struct);

            FATBuffer[beginBlockNum] = -1;
            WriteFAT(FileDiskHandle, FATBuffer);
        } else {
            throw new Error("file not exists");
        }
    } 
    let handle = findHandle();
    let openedfile = new OpenedFile.OpenedFile();
    openedfile.filename = filename;
    openedfile.begin_num = dirItem.begin_num;
    openedfile.flag = flag;
    openedfile.size = dirItem.size;
    openedfile.ptr_block = openedfile.begin_num;
    openedFileHandles[handle] = openedfile
    return handle;
}

exports.close = (handle) => {
    openedFileHandles[handle] = undefined;
}

exports.seek = (fd, position) => {
    if (openedFileHandles[fd] === undefined) 
        throw new Error("fd is not valid");
    let openedfile = openedFileHandles[fd];
    if (position > openedfile.size) {
        throw new Error("out of file");
    }
    let blocknum = openedfile.begin_num;
    let blockID = parseInt(position / BLOCK_SIZE);
    let blockOffset = position % BLOCK_SIZE;
    for (let i = 0; i < blockID; i++) {
        blocknum = FATBuffer[blocknum];
    }
    openedfile.ptr_block = blocknum;
    openedfile.ptr_byte = blockOffset;
}

exports.read = (fd, buf, offset, length) => {
    if (openedFileHandles[fd] === undefined) 
        throw new Error("fd is not valid");
    let openedfile = openedFileHandles[fd];
    let tmp_length = length;
    let tmp_buf = Buffer.alloc(length);
    let tmp_offset = 0;
    while (tmp_offset < length) {
        let bytesCount = Math.min(BLOCK_SIZE - openedfile.ptr_byte, length - tmp_offset);
        fs.readSync(FileDiskHandle, tmp_buf, tmp_offset, bytesCount, openedfile.ptr_block * BLOCK_SIZE + openedfile.ptr_byte);
        tmp_offset += bytesCount;
        if (openedfile.ptr_byte >= BLOCK_SIZE) {
            openedfile.ptr_block = FATBuffer[openedfile.ptr_block];
            openedfile.ptr_byte = 0;
        } else {
            openedfile.ptr_byte += bytesCount;
        }
    }
    tmp_buf.copy(buf, offset, 0, length);
}

exports.write = (fd, buf, offset, length) => {
    if (openedFileHandles[fd] === undefined) 
        throw new Error("fd is not valid");
    let openedfile = openedFileHandles[fd];
    while (length > 0) {
        let bytesCount = Math.min(BLOCK_SIZE - openedfile.ptr_byte, length - offset);
        fs.writeSync(FileDiskHandle, buf, offset, bytesCount, openedfile.ptr_block * BLOCK_SIZE + openedfile.ptr_byte);
        offset += bytesCount;
        length -= bytesCount;
        if (length > 0 && FATBuffer[openedfile.ptr_block] === -1) {
            let nextBlockNum = findNullFATBlockNum();
            FATBuffer[openedfile.ptr_block] = nextBlockNum;
            FATBuffer[nextBlockNum] = -1;
            WriteFAT(FileDiskHandle, FATBuffer);
            openedfile.ptr_byte = 0;
            openedfile.ptr_block = nextBlockNum;
        } else {
            openedfile.ptr_byte += bytesCount;
        }
    }
}

exports.stat = (filename) => {
    if (filename[0] != '/') {
        throw new Error("The path must starts with '/'");
    }
    let slices = filename.split('/').slice(1);  // slice and remove the first element
    let realname = slices[slices.length - 1];
    let fatherResult = getFatherDirStruct(slices);
    let dirItem = findChildFromDirStruct(fatherResult.struct, realname);
    if (dirItem === null) {
        // file not exists
        return null;
    } 
    return dirItem;
}

exports.listdir = (filename) => {
    if (filename[0] != '/') {
        throw new Error("The path must starts with '/'");
    }
    let slices = filename.split('/').slice(1);  // slice and remove the first element
    let realname = slices[slices.length - 1];
    let fatherResult = getFatherDirStruct(slices);
    let dirItem = findChildFromDirStruct(fatherResult.struct, realname);
    if (dirItem === null) {
        // file not exists
        return null;
    } 
    let result = dirstruct.readDirStructFromDisk(FileDiskHandle, dirItem.begin_num * BLOCK_SIZE);
    return result.data;
}

exports.remove = (filename) => {
    if (filename[0] != '/') {
        throw new Error("The path must starts with '/'");
    }
    let slices = filename.split('/').slice(1);  // slice and remove the first element
    let realname = slices[slices.length - 1];
    let fatherResult = getFatherDirStruct(slices);
    let dirItem = findChildFromDirStruct(fatherResult.struct, realname);
    if (dirItem === null) {
        // file not exists
        throw new Error("file not exists");
    } 
    fatherResult.struct.remove(realname);
    dirstruct.writeDirStructToDisk(FileDiskHandle, fatherResult.number * BLOCK_SIZE, fatherResult.struct);

    let begin_num = dirItem.begin_num;
    while (begin_num !== -1) {
        let tmp = begin_num;
        begin_num = FATBuffer[begin_num];
        FATBuffer[tmp] = 0;
    }
    WriteFAT(FileDiskHandle, FATBuffer);
}

exports.createdir = (filename) => {
    if (filename[0] != '/') {
        throw new Error("The path must starts with '/'");
    }
    let slices = filename.split('/').slice(1);  // slice and remove the first element
    let realname = slices[slices.length - 1];
    let fatherResult = getFatherDirStruct(slices);
    let dirItem = findChildFromDirStruct(fatherResult.struct, realname);
    if (dirItem !== null) {
        // file exists
        throw new Error("file already exists");
    } 
    let beginBlockNum = findNullFATBlockNum();

    dirItem = new dirstruct.DirItem();
    dirItem.name = realname;
    dirItem.type = ZFILE_TYPE_DIR;
    dirItem.dir_num = fatherResult.number;
    dirItem.begin_num = beginBlockNum;
    dirItem.created_time = new Date().getTime();
    dirItem.edited_time = new Date().getTime();

    fatherResult.struct.data.push(dirItem);
    dirstruct.writeDirStructToDisk(FileDiskHandle, fatherResult.number * BLOCK_SIZE, fatherResult.struct);

    FATBuffer[beginBlockNum] = -1;
    WriteFAT(FileDiskHandle, FATBuffer);

    let newDir = new dirstruct.DirStruct();
    let fatherItem = new dirstruct.DirItem();
    fatherItem.name = "..";
    fatherItem.type = ZFILE_TYPE_DIR;
    fatherItem.dir_num = beginBlockNum;
    fatherItem.begin_num = fatherResult.number;
    fatherItem.created_time = new Date().getTime();
    fatherItem.edited_time = new Date().getTime();
    newDir.data.push(fatherItem);
    dirstruct.writeDirStructToDisk(FileDiskHandle, beginBlockNum * BLOCK_SIZE, newDir);
}

exports.getFATValue = (index) => {
    return FATBuffer[index];
}

exports.ZFILE_FLAG_READ = ZFILE_FLAG_READ;
exports.ZFILE_FLAG_WRITE = ZFILE_FLAG_WRITE;
exports.ZFILE_FLAG_APPEND = ZFILE_FLAG_APPEND;
