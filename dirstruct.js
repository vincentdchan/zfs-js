/************************ 
 * Author: DZ Chan 
 * Date:   2017-09-02 
 ************************/ 

const fs = require('fs');

const DIRITEM_LEGNTH = 154;

function readDirStructFromDisk(fd, offset) {
    let result = new DirStruct();

    let lenBuf = Buffer.alloc(4);
    fs.readSync(fd, lenBuf, 0, 4, offset);
    let len = lenBuf.readInt32BE(0);
    if (len < 0 || len > 15) {
        throw new Error("read dir struct error");
    }
    offset += 4;
    for (let i = 0; i < len; i++) {
        // read item
        let itemBuffer = Buffer.alloc(DIRITEM_LEGNTH);
        fs.readSync(fd, itemBuffer, 0, DIRITEM_LEGNTH, offset + i * DIRITEM_LEGNTH);

        let item = new DirItem();
        item.fromBuffer(itemBuffer);

        result.data.push(item);
    }
    return result;
}

function writeDirStructToDisk(fd, offset, dirStruct) {
    let lenBuf = Buffer.alloc(4);
    lenBuf.writeInt32BE(dirStruct.length);
    fs.writeSync(fd, lenBuf, 0, 4, offset);
    offset += 4;
    for (let i = 0; i < dirStruct.length; i++) {
        let item = dirStruct.data[i];
        let buf = item.toBytes();
        fs.writeSync(fd, buf, 0, DIRITEM_LEGNTH, offset);
        offset += DIRITEM_LEGNTH;
    }
}

// name: 128 bytes
// attr: 1 byte
// type: 1 byte
// size: 4 bytes
// dir_num: 2 bytes
// begin_num: 2bytes
// created_time: 8 bytes
// edited_time: 8 bytes
// 
// total: 154 bytes
class DirItem {

    constructor() {
        this.name = "";
        this.attr = 0;
        this.type = 0;
        this.size = 0;
        this.dir_num = 1;
        this.begin_num = 2;
        this.created_time = new Date().getTime();
        this.edited_time = new Date().getTime();
    }

    toBytes() {
        let buf = Buffer.alloc(154);
        buf.write(this.name, 0, 128, "utf8");
        buf.writeInt8(this.attr, 128);
        buf.writeInt8(this.type, 129);
        buf.writeInt32BE(this.size, 130);
        buf.writeUInt16BE(this.dir_num, 132);
        buf.writeUInt16BE(this.begin_num, 134);
        buf.writeIntBE(this.created_time, 138, 8);
        buf.writeIntBE(this.edited_time, 146, 8);
        return buf;
    }

    fromBuffer(buffer) {
        this.name = buffer.toString("utf8", 0, 128).split('\u0000')[0];
        this.attr = buffer.readInt8(128);
        this.type = buffer.readInt8(129);
        this.size = buffer.readInt32BE(130);
        this.dir_num = buffer.readUInt16BE(132);
        this.begin_num = buffer.readUInt16BE(134);
        this.created_time = buffer.readIntBE(138, 8);
        this.edited_time = buffer.readIntBE(146, 8);
    }

}

class DirStruct {

    constructor() {
        this._data = []
    }

    get data() {
        return this._data;
    }

    get length() {
        return this._data.length;
    }

};

exports.readDirStructFromDisk = readDirStructFromDisk;
exports.writeDirStructToDisk = writeDirStructToDisk;
exports.DirItem = DirItem;
exports.DirStruct = DirStruct;
