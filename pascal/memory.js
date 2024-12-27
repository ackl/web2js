'use strict';

module.exports = class Memory {
    constructor(m, pages) {
        this.module = m;
        this.strings = [];
        this.memorySize = 0;
        this.pages = pages;

        const commands = (bytes, loader, storer) => {
            return {
                width: bytes,
                loader: loader,
                storer: storer,
                memory: this,

                load(offset, base) {
                    return this.loader(offset, 0, base);
                },

                store(offset, expression, base) {
                    return this.storer(offset, 0, base, expression);
                }
            };
        };

        this.i32 = commands(4, this.module.i32.load, this.module.i32.store);
        this.i64 = commands(4, this.module.i64.load, this.module.i64.store); // Shouldn't this be 8 bytes?
        this.u8 = commands(1, this.module.i32.load8_u, this.module.i32.store8);
        this.s8 = commands(1, this.module.i32.load8_s, this.module.i32.store8);
        this.s16 = commands(2, this.module.i32.load16_s, this.module.i32.store16);
        this.u16 = commands(2, this.module.i32.load16_u, this.module.i32.store16);
        this.f32 = commands(4, this.module.f32.load, this.module.f32.store);
        this.f64 = commands(8, this.module.f64.load, this.module.f64.store);
        this.none = { load() {}, store() {} };
    }

    setup() {
        const neededPages = Math.ceil(this.memorySize / 65536);
        const module = this.module;

        if (this.pages < neededPages) {
            throw `Need ${neededPages} of memory`;
        }

        module.addMemoryImport('0', 'env', 'memory');
        module.setMemory(
            this.pages,
            this.pages,
            '0',
            this.strings.map((s) => ({ offset: module.i32.const(s.offset), data: s.data }))
        );
    }

    allocateString(string) {
        const buffer = Buffer.concat([Buffer.from([string.length]), Buffer.from(string)]);
        this.strings.push({ offset: this.memorySize, data: buffer });
        const pointer = this.memorySize;
        this.memorySize += buffer.length;
        return pointer;
    }

    dereferencedVariable(name, type, referent, base) {
        const memory = this;
        const module = this.module;

        if (base === undefined) base = module.i32.const(0);

        return {
            name: name,
            type: type,
            base: base,
            referent: referent,

            set(expression) {
                return memory.byType(this.type).store(0, expression, module.i32.add(this.referent.get(), this.base));
            },

            get() {
                return memory.byType(this.type).load(0, module.i32.add(this.referent.get(), this.base));
            },

            rebase(type, base) {
                return memory.dereferencedVariable(this.name, type, this.referent, module.i32.add(this.base, base));
            },

            pointer() {
                return referent.get();
            }
        };
    }

    variable(name, type, offset, base) {
        const memory = this;
        const module = this.module;

        if (base === undefined) base = module.i32.const(0);

        return {
            name: name,
            offset: offset,
            type: type,
            base: base,

            set(expression) {
                return memory.byType(this.type).store(this.offset, expression, this.base);
            },

            get() {
                return memory.byType(this.type).load(this.offset, this.base);
            },

            rebase(type, base) {
                return memory.variable(this.name, type, this.offset, module.i32.add(this.base, base));
            },

            pointer() {
                return module.i32.add(module.i32.const(this.offset), this.base);
            }
        };
    }

    allocateVariable(name, type) {
        // align everything to 4-byte boundaries
        if (this.memorySize % 4 !== 0) this.memorySize += 4 - (this.memorySize % 4);

        const pointer = this.memorySize;
        this.memorySize += type.bytes();

        return this.variable(name, type, pointer);
    }

    byType(type) {
        if (type.fileType) {
            return this.i32;
        }

        if (type.lower && type.upper) {
            const min = type.lower.number;
            const max = type.upper.number;

            if (min == 0 && max == 255) return this.u8;
            if (min == -127 && max == 128) return this.s8;
            if (min == 0 && max == 65535) return this.u16;
            if (min == -32767 && max == 32768) return this.s16;
            if (type.bytes() <= 4) return this.i32;
        }

        if (type.name == 'integer') return this.i32;
        if (type.name == 'char') return this.u8;
        if (type.name == 'boolean') return this.u8;
        if (type.name == 'real') return this.f32;
        if (type.bytes() == 4) return this.i32;
        if (type.bytes() == 8) return this.i64;
        if (type.bytes() == 2) return this.u16;
        if (type.bytes() == 1) return this.u8;

        return this.none;
    }
};
