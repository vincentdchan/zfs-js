/************************ 
 * Author: DZ Chan 
 * Date:   2017-09-02 
 ************************/ 

const fs = require("fs");
const dirstruct = require("./dirstruct");
const OpenedFile = require('./openedfile');
const path = require('path');

// const BLOCK_SIZE = 4 * 1024;
// const BLOCK_NUM = 256
const BLOCK_SIZE = 1024;
const BLOCK_NUM = 64
const FILEDISK_SIZE = BLOCK_NUM * BLOCK_SIZE;

const ZFILE_FLAG_READ = 0x1;
const ZFILE_FLAG_WRITE = 0x2;
const ZFILE_FLAG_APPEND = 0x4;

const ZFILE_TYPE_FILE = 0x0;
const ZFILE_TYPE_DIR = 0x1;

const generateFATBuffer = () => {
    let result = [];
    for (let i = 0; i < BLOCK_NUM; i++) {
        result.push(0);
    }
    result[0] = 1;
    result[1] = -1;
    return result;
}

let FATBuffer = generateFATBuffer();
let FileDiskHandle;

let openedFileHandles = [];
openedFileHandles.length = 128;

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
    const bytesNumber = BLOCK_NUM * 2;
    const buffer = Buffer.alloc(bytesNumber);
    let offset = 0;
    while (offset < bytesNumber) {
        offset += fs.readSync(FileDiskHandle, buffer, offset, bytesNumber - offset, offset);
    }
    for (let i = 0; i < BLOCK_NUM; i++) {
        FATBuffer[i] = buffer.readInt16BE(i*2, true);
    }
}

function WriteFAT(fd, fatBuffer) {
    const bytesNumber = BLOCK_NUM * 2;
    const buffer = Buffer.alloc(bytesNumber);
    for (let i = 0; i < 256; i++) {
        buffer.writeInt16BE(FATBuffer[i], i * 2, true);
    }
    let offset = 0;
    while (offset < bytesNumber) {
        offset += fs.writeSync(FileDiskHandle, buffer, offset, bytesNumber - offset, offset);
    }
}

// zfs连接到一个系统文件上
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

// 从一个目录结构中找到一个子项
function findChildFromDirStruct(father, children_name) {
    for (let i = 0; i < father.length; i++) {
        let item = father.data[i];
        if (item.name == children_name) {
            return item;
        }
    }
    return null;
}

// 从一个子目录中找到一个子目录，并读出来
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

// 找到一个地址的父目录结构
function getFatherDirStruct(slices) {
    let blocknum = 1;
    let dirStruct = dirstruct.readDirStructFromDisk(FileDiskHandle, blocknum * BLOCK_SIZE); // 根目录结构
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
    let realname = path.basename(filename);
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
    openedfile.dir_block_id = fatherResult.number;
    openedFileHandles[handle] = openedfile
    return handle;
}

exports.close = (handle) => {
    openedFileHandles[handle] = undefined;
}

exports.seek = (fd, position) => {
    console.error("此方法在2.0.0版本已被遗弃，请用readAll方法");
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

function chunkBuf(buf, size) {
    let length = buf.length;
    let num = parseInt(length / size);
    let last_size = length % size;
    let result = [];
    for (let i = 0; i < num; i++) {
        let tmpBuf = Buffer.alloc(size);
        buf.copy(tmpBuf, 0, i * size, (i + 1) * size)
        result.push(tmpBuf)
    }
    if (last_size > 0) {
        let tmpBuf = Buffer.alloc(last_size)
        buf.copy(tmpBuf, 0, num * size, num * size + last_size)
        result.push(tmpBuf)
    }
    return result;
}

function chunkSize(number, size) {
    let num = parseInt(number / size);
    let last = number % size;
    let result = [];
    for (let i = 0; i < num; i++) {
        result.push(size)
    }
    if (last > 0) {
        result.push(last);
    }
    return result;
}

exports.readAll = (fd) => {
    if (openedFileHandles[fd] === undefined) 
        throw new Error("fd is not valid");
    let openedfile = openedFileHandles[fd];
    let _size = openedfile.size;
    if (_size === 0) return null;
    let buf = Buffer.alloc(_size);

    let sizeArr = chunkSize(_size, BLOCK_SIZE);
    let readBlock = openedfile.ptr_block;

    let counter = 0;
    let totalOffset = 0;
    while (true) {
        let readSize = sizeArr[counter];
        let tmpBuf = Buffer.alloc(readSize);

        fs.readSync(FileDiskHandle, tmpBuf, 0, readSize, 
            readBlock * BLOCK_SIZE);

        tmpBuf.copy(buf, totalOffset, 0, readSize);

        totalOffset += readSize;
        counter++;
        readBlock = FATBuffer[readBlock];
        if (readBlock < 0) {
            break;
        }
    }

    return buf;
}

function clearFAT(beginId) {
    let nextId = FATBuffer[beginId];

    while (nextId > 0) {
        let tmp = FATBuffer[nextId];
        FATBuffer[nextId] = 0;
        nextId = tmp;
    }
}

exports.writeAll = (fd, buf_or_str) => {
    if (openedFileHandles[fd] === undefined) 
        throw new Error("fd is not valid");
    let openedfile = openedFileHandles[fd];

    let buf;
    if (buf_or_str instanceof Buffer) {
        buf = buf_or_str;
    } else if (typeof buf_or_str == 'string') {
        buf = Buffer.from(buf_or_str)
    } else {
        throw new Error("The second parameter of 'readAll' must be Buffer or String")
    }

    // 清除FAT表，删除旧内容
    clearFAT(openedfile.ptr_block);

    // 修改父目录相应的文件信息
    let dirStruct = dirstruct.readDirStructFromDisk(FileDiskHandle, 
        openedfile.dir_block_id * BLOCK_SIZE)
    
    let dirItem;
    for (let i = 0; i < dirStruct.length; i++) {
        let item = dirStruct.data[i];
        let basename = path.basename(openedfile.filename);
        if (item.name == basename) {
            dirItem = item;
            break;
        }
    }

    dirItem.edited_time = new Date().getTime();
    dirItem.size = buf.length;

    dirstruct.writeDirStructToDisk(FileDiskHandle, 
        openedfile.dir_block_id * BLOCK_SIZE, dirStruct)
    
    // 把内容写到文件里面 
    let bufArr = chunkBuf(buf, BLOCK_SIZE);

    let offset = 0;
    let blockId = openedfile.ptr_block;
    for (let i = 0; i < bufArr.length; i++) {
        let buf = bufArr[i];
        fs.writeSync(FileDiskHandle, buf, 0, buf.length, blockId * BLOCK_SIZE);

        if (i != bufArr.length - 1) {
            let newId = findHandle();
            FATBuffer[blockId] = newId;
            blockId = newId;
        }
    }

    // 把FAT表写回文件
    WriteFAT(FileDiskHandle, FATBuffer);
}

exports.read = (fd, buf, offset, length) => {
    console.error("此方法在2.0.0版本已被遗弃，请用readAll方法");
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
    console.error("此方法在2.0.0版本已被遗弃，请用writeAll方法");
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
    if (filename == '/') {
        let dirStruct = dirstruct.readDirStructFromDisk(FileDiskHandle, 1 * BLOCK_SIZE); // 根目录结构
        return dirStruct.data;
    } else {
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
}

exports.remove = (filename) => {
    if (filename[0] != '/') {
        throw new Error("The path must starts with '/'");
    }
    let slices = filename.split('/').slice(1);  // slice and remove the first element
    let realname = path.basename(filename);
    let fatherResult = getFatherDirStruct(slices);
    let dirItem = findChildFromDirStruct(fatherResult.struct, realname);
    if (dirItem === null) {
        // file not exists
        throw new Error("file not exists");
    } 
    let beginId = dirItem.begin_num;
    clearFAT(beginId);
    FATBuffer[beginId] = 0;

    fatherResult.struct.remove(realname);
    dirstruct.writeDirStructToDisk(FileDiskHandle, fatherResult.number * BLOCK_SIZE, fatherResult.struct);

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

exports.getFATBuffer = () => {
    return FATBuffer;
}

exports.ZFILE_FLAG_READ = ZFILE_FLAG_READ;
exports.ZFILE_FLAG_WRITE = ZFILE_FLAG_WRITE;
exports.ZFILE_FLAG_APPEND = ZFILE_FLAG_APPEND;
