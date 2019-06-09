#!/usr/bin/env node
/* eslint no-mixed-operators: "off" */
require('colors');
const brokenConsole = require('console');
const repl = require('repl');
const events = require('events');
const fs = require('fs');
const path = require('path');

const WebSocket = require('ws');
const History = require('repl.history');

const ee = new events.EventEmitter();
const wss = new WebSocket.Server({ port: 8100 });

const historyPath = path.resolve(__dirname, '.shell_history');

//This is needed to update the output to the console so the writing in start.js shows
console.log('');

function sendMsg (cmd, ws, args = []) {
	ws.send(JSON.stringify({
		cmd,
		args
	}));
}

ee.on('error', function (message) {
	brokenConsole.error('ERROR:', message.slice(0, 2));
});

function loadConfig() {
	try {
		fs.statSync("config.json"); // test existence
		return JSON.parse(fs.readFileSync("config.json", "utf-8"));
	} catch(e) {
		var config = { // default config
		};
		fs.writeFileSync("config.json", JSON.stringify(config), "utf-8");
		return config;
	}
}

const fns = {
	evalfile: {
		response: 'evald',
		help: 'evalfile <filename>',
		helptxt: 'Evals code read from file',
		setup: function (args, callback) {
			try {
				var filepath = path.resolve(__dirname, args[0]);
				fs.statSync(filepath);
				return [fs.readFileSync(filepath).toString()];
			} catch (e) {
				return callback(null, 'invalid file ' + e.message);
			}
		}
	},
	quit: {
		help: 'quit',
		helptxt: 'Close REPL and shut off server',
		noSend: true,
		setup(args, callback) {
			process.exit();
		}
	}
};

function showHelp (callback) {
	for (let k in fns) {
		let out = `${k.bold}: ${fns[k].helptxt}`;
		if (fns[k].help) {
			out += ` (${fns[k].help})`.dim;
		}
		console.log(out);
	}
	console.log();
	return callback();
}

let _; // last value reg
let isJavascript = false;

function defaultHandler (saveVal, callback) {
	return function (response) {
		if (saveVal) {
			_ = response;
		}
		return callback(null, response);
	};
}

function handle (input, context, filename, callback) {
	let tmp = input.replace(/\n$/, '');

	let saveVal = false;

	let args = tmp.trimLeft().split(' ');
	let cmd = args.shift();

	if (cmd === 'help') {
		return showHelp(callback);
	}

	let fn = fns[cmd];

	if (!fn) {
		return callback(null, 'unknown cmd');
	}

	if (
		fn.args !== undefined && fn.args !== args.length ||
						fn.minArgs !== undefined && fn.minArgs > args.length ||
						fn.maxArgs !== undefined && args.length > fn.maxArgs
	) {
		return callback(null, fn.help);
	}

	if (fn.setup) {
		args = fn.setup(args, callback);
		if (!args) {
			return;
		}
	}

	if (!fn.noSend) {
		var handle = fn.handler ? fn.handler(args, callback) : defaultHandler(saveVal, callback);

		ee.once(fn.response, handle);

		sendMsg(cmd, args);

		if (fn.wait === false) {
			ee.removeListener(fn.response, handle);
			return callback();
		}
	}
}

function complete (line) {
	var args = line.split(' ');
	var cmd = args.shift();

	if (args.length === 0) {
		return [cmd.length ? Object.keys(fns).map((name) => name + ' ').filter((fn) => fn.startsWith(cmd)) : Object.keys(fns), line];
	} else {
		if (fns[cmd] && fns[cmd].complete) {
			return fns[cmd].complete(line);
		} else {
			return [[], line];
		}
	}
}

const r = repl.start({
	prompt: '',
	eval: handle,
	completer: complete
});

History(r, historyPath);

// looks for autorun var [bool]
// in config.json
function checkAutoRun(){
	var result = false;

	try{
		var tmp = loadConfig().autorunScript;
		if (typeof tmp === "boolean"){
			result = tmp;
		} else {
			console.log("tried to load non-bool input");
		}
	} catch (e){
		console.log("failed to load config.json");
	}

	return result;
}


// tries to load the js file speified in config.json
function loadScript(reqScript){
	var script = "";
	var scriptPath = "";
	try{
		if (reqScript in loadConfig().scripts) {
			scriptPath = loadConfig().scripts[reqScript].scriptPath;
		} else {
			return undefined;
		}
		script = fns.evalfile.setup([scriptPath], (obj, output) => {
			 throw output;
	 	});

		script += `alert(\"Success!\");\n`

	} catch (e){
		console.log(e);
		process.exit(1);
	}

	return script;
}

wss.on('connection', function (ws) {
	ws.on('message', function(data) {
		data = JSON.parse(data);
		const type = data.type;
		const response = data.response;

		if(type == "identification") {
			var u8 = new Uint8Array(0x18);
			var u32 = new Uint32Array(u8.buffer);
			for(var i = 0; i < data.serial.length; i++) {
				u32[i] = data.serial[i];
			}
			var serial = String.fromCharCode.apply(null, u8);
			ws.serial = serial;
			ws.fwVersion = data.version;
			if(checkAutoRun()){
				const reqScript = data.script;
				script = loadScript(reqScript);
				if (script != undefined) {
					sendMsg("evalfile", ws, [script]);
				}
				ws.terminate();
			}
		} else {
			ee.emit(type, response, ws.serial);
		}
	});
});

r.on('exit', () => {
	process.exit();
});