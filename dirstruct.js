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
// number: 4bytes
// created_time: 8 bytes
// edited_time: 8 bytes
// 
// total: 154 bytes
class DirItem {

    constructor() {
        this._name = "";
        this._attr = 0;
        this._type = 0;
        this._size = 0;
        this._number = 1;
        this._created_time = new Date().getTime();
        this._edited_time = new Date().getTime();
    }

    toBytes() {
        let buf = Buffer.alloc(154);
        buf.write(this._name, 0, 128, "utf8");
        buf.writeInt8(this._attr, 128);
        buf.writeInt8(this._type, 129);
        this.writeInt32BE(this._size, 130);
        this.writeInt32BE(this._number, 134);
        this.writeIntBE(this._created_time, 138, 8);
        this.writeIntBE(this._edited_time, 146, 8);
        return buf;
    }

    fromBuffer(buffer) {
        this._name = buffer.toString("utf8", 0, 128);
        this._attr = buffer.readInt8(128);
        this._type = buffer.readInt8(129);
        this._size = buffer.readInt32BE(130);
        this._number = buffer.readInt32BE(134);
        this._created_time = buffer.readUintBE(138, 8);
        this._edited_time = buffer.readUintBE(146, 8);
    }

    get name() {
        return this._name;
    }

    get attr() {
        return this._attr;
    }

    get type() {
        return this._type;
    }

    get size() {
        return this._size;
    }

    get number() {
        return this._number;
    }

    get created_time() {
        return this._created_time;
    }

    get edited_time() {
        return this._edited_time;
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
