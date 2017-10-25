/************************ 
 * Author: DZ Chan 
 * Date:   2017-09-03 
 ************************/ 

class OpenedFile {

    constructor() {
        this.filename = ""; // 文件名
        this.begin_num = 0; // 文件开始块
        this.flag = 0;  // 打开文件的属性
        this.size = 0;  // 大小
        this.ptr_block = 0; // 指针指向的文件块
        // this.ptr_byte = 0; // 指针指向文件快的字节
        this.dir_block_id = 1;  // 文件所在目录的块地址
    }

}

exports.OpenedFile = OpenedFile;
