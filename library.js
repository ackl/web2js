var fs = require('fs');
var process = require('process');
var callstack = [];
var stackstack = [];
var files = [];

var kpathsea = require('node-kpathsea');
const Kpathsea = kpathsea.Kpathsea;
const FILE_FORMAT = kpathsea.FILE_FORMAT;
const kpse = new Kpathsea("latex");

var usedFiles = {};

var memory = undefined;
var inputBuffer = undefined;
var callback = undefined;
var texPool = "tex.pool";

module.exports = {
	setMemory: function(m) {
		memory = m;
	},

	setTexPool: function(m) {
		texPool = m;
	},

	setInput: function(input, cb) {
		inputBuffer = input;
		if (cb) callback = cb;
	},

	getUsedFiles: function() {
		return usedFiles;
	},

	getCurrentMinutes: function() {
		var d = (new Date());
		return 60 * (d.getHours()) + d.getMinutes();
	},

	getCurrentDay: function () {
		return (new Date()).getDate();
	},

	getCurrentMonth: function() {
		return (new Date()).getMonth() + 1;
	},

	getCurrentYear: function() {
		return (new Date()).getFullYear();
	},

	printString: function(descriptor, x) {
		var file = (descriptor < 0) ? {stdout:true} : files[descriptor];
		var length = new Uint8Array(memory, x, 1)[0];
		var buffer = new Uint8Array(memory, x+1, length);
		var string = String.fromCharCode.apply(null, buffer);

		if (file.stdout) {
			process.stdout.write(string, () => {});
			return;
		}

		fs.writeSync(file.descriptor, string);
	},

	printBoolean: function(descriptor, x) {
		var file = (descriptor < 0) ? {stdout:true} : files[descriptor];

		var result = x ? "TRUE" : "FALSE";

		if (file.stdout) {
			process.stdout.write(result);
			return;
		}

		fs.writeSync(file.descriptor, result);
	},
	printChar: function(descriptor, x) {
		var file = (descriptor < 0) ? {stdout:true} : files[descriptor];
		if (file.stdout) {
			process.stdout.write(String.fromCharCode(x));
			return;
		}

		var b = Buffer.alloc(1);
		b[0] = x;
		fs.writeSync(file.descriptor, b);
	},
	printInteger: function(descriptor, x) {
		var file = (descriptor < 0) ? {stdout:true} : files[descriptor];
		if (file.stdout) {
			process.stdout.write(x.toString());
			return;
		}

		fs.writeSync(file.descriptor, x.toString());
	},
	printFloat: function(descriptor, x) {
		var file = (descriptor < 0) ? {stdout:true} : files[descriptor];
		if (file.stdout) {
			process.stdout.write(x.toString());
			return;
		}

		fs.writeSync(file.descriptor, x.toString());
	},
	printNewline: function(descriptor, x) {
		var file = (descriptor < 0) ? {stdout:true} : files[descriptor];
		if (file.stdout) {
			process.stdout.write("\n");
			return;
		}

		fs.writeSync(file.descriptor, "\n");
	},

	reset: function(length, pointer) {
		var buffer = new Uint8Array(memory, pointer, length);
		var filename = String.fromCharCode.apply(null, buffer);

		filename = filename.replace(/\000+$/g,'');

		if (filename.startsWith('{')) {
			filename = filename.replace(/^{/g, '');
			filename = filename.replace(/}.*/g, '');
		}

		if (filename.startsWith('"')) {
			filename = filename.replace(/^"/g, '');
			filename = filename.replace(/".*/g, '');
		}

		filename = filename.replace(/ +$/g, '');
		filename = filename.replace(/^\*/, '');

		let format = FILE_FORMAT.TEX;

		if (filename.startsWith('TeXfonts:')) {
			filename = filename.replace(/^TeXfonts:/, '');
			format = FILE_FORMAT.TFM;
		}

		if (filename == 'TeXformats:TEX.POOL' || filename == 'tex.pool') {
			filename = texPool;
			format = FILE_FORMAT.TEXPOOL;
		}

		if (filename == "TTY:") {
			files.push({ filename: "stdin",
				stdin: true,
				position: 0,
				position2: 0,
				erstat: 0,
				eoln: false,
				content: Buffer.from(inputBuffer)
			});
			return files.length - 1;
		}

		var path = kpse.findFile(filename, format);

		if (path == undefined) {
			files.push({
				filename: filename,
				erstat: 1
			});
			return files.length - 1;
		}

		usedFiles[filename] = path;

		files.push({
			filename: filename,
			position: 0,
			position2: 0,
			erstat: 0,
			eoln: false,
			descriptor: fs.openSync(path, 'r'),
			content: fs.readFileSync(path)
		});

		return files.length - 1;
	},

	rewrite: function(length, pointer) {
		var buffer = new Uint8Array(memory, pointer, length);
		var filename = String.fromCharCode.apply(null, buffer);

		filename = filename.replace(/ +$/g, '');

		if (filename.startsWith('"')) {
			filename = filename.replace(/^"/g, '');
			filename = filename.replace(/".*/g, '');
		}

		if (filename == "TTY:") {
			files.push({ filename: "stdout",
				stdout: true,
				erstat: 0,
			});
			return files.length - 1;
		}

		files.push({
			filename: filename,
			position: 0,
			writing: true,
			erstat: 0,
			output: [],
			descriptor: fs.openSync(filename, 'w')
		});

		return files.length - 1;
	},

	close: function(descriptor) {
		var file = files[descriptor];

		if (file.descriptor) {
			if (file.writing) {
				fs.write(file.descriptor, Buffer.concat(file.output), () => {});
			}
			fs.close(file.descriptor, () => {});
		}

		files[descriptor] = {};
	},

	eof: function(descriptor) {
		var file = files[descriptor];

		if (file.eof)
			return 1;
		else
			return 0;
	},

	erstat: function(descriptor) {
		var file = files[descriptor];
		return file.erstat;
	},

	eoln: function(descriptor) {
		var file = files[descriptor];

		if (file.eoln)
			return 1;
		else
			return 0;
	},

	get: function(descriptor, pointer, length) {
		var file = files[descriptor];

		var buffer = new Uint8Array(memory);

		if (file.stdin) {
			if (file.position >= inputBuffer.length) {
				buffer[pointer] = 13;
				if (callback) callback();
			} else {
				buffer[pointer] = inputBuffer[file.position].charCodeAt(0);
			}
		} else {
			if (file.descriptor) {
				let endOfCopy = Math.min(file.position + length, file.content.length);

				var bytesCopied = file.content.copy(buffer, pointer, file.position, endOfCopy);

				if (bytesCopied == 0) {
					buffer[pointer] = 0;
					file.eof = true;
					file.eoln = true;
					return;
				}
			} else {
				file.eof = true;
				file.eoln = true;
				return;
			}
		}

		file.eoln = false;
		if (buffer[pointer] == 10)
			file.eoln = true;
		if (buffer[pointer] == 13)
			file.eoln = true;

		file.position = file.position + length;
	},

	put: function(descriptor, pointer, length) {
		var file = files[descriptor];
		var buffer = new Uint8Array(memory, pointer, length);

		if (file.writing)
			file.output.push(Buffer.from(buffer));
	},
};
