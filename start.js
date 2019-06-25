const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const browserify = require('browserify');
const exorcist = require('exorcist');
const sourceMap = require('source-map');
const dnsd = require('dnsd');
const ip = require('ip');
const express = require('express');
const bodyParser = require('body-parser');
const mkdirp = require('mkdirp');
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const yargs = require('yargs');

// const dnslookup = require('dns')


let argv = yargs
	.usage('Usage $0')
	.describe('disable-dns', 'Disables builtin DNS server.')
	.describe('ip', 'Override IP address DNS server responds with')
	.describe('host', 'Override listen IP.')
	.describe('logfile', 'Writes debug log to file')
	.example('$0 --ip 1.2.4.8 --logfile debug.txt --setuid 1000')
	.help('h')
	.nargs('ip', 1)
	.nargs('host', 1)
	.nargs('logfile', 1)
	.nargs('setuid', 1)
	.alias('h', 'help')
	.argv;

if(os.platform() === 'win32') {
	if(argv['enable-curses']) {
		console.warn('WARNING: pegaswitch does not support curses on Windows. Curses disabled by default.');
		argv['enable-curses'] = false;
	}

}

argv.logfile = 'pegaswitch.log'

let logf = {
	log: function (data) {
		if (!argv.logfile) {
			return;
		}
		fs.writeFileSync(path.resolve(__dirname, argv.logfile), `${data}\n`, {
			flag: 'a'
		});
	}
};


let dnsServerStarted;
let httpServerStarted;

let ipAddr = argv.ip || ip.address();
if (argv['disable-dns'] !== true) {

	// Spin up our DNS server
	let dns = dnsd.createServer(function (req, res) {
		res.end(ipAddr);
	});

	dnsServerStarted = new Promise((resolve, reject) => {
		dns.on('error', function (err) {
			console.log(`There was an issue setting up DNS: ${err.message}`);
			reject();
			process.exit();
		});

		dns.listen(53, argv.host || '0.0.0.0', () => {
			resolve();
		});
	});
} else {
	dnsServerStarted = Promise.resolve();
}

// Web server
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

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

function serveIndex (req, res) {
    
    if (!(loadConfig().bannedips == null) && loadConfig().bannedips.includes(req.ip) == true) {
        return res.sendStatus(503);
    }
    
	var indexT = fs.readFileSync(path.resolve(__dirname, 'exploit/index.html'), "utf-8");
	if (!(req.headers['user-agent'] == null)) {
		var version = getVersionFromUA(req.headers['user-agent']);
		var items = "";
		Object.keys(loadConfig().scripts).forEach(function(script) {
			script = loadConfig().scripts[script];
			if (version >= script.minversion && version <= script.maxversion) {
				items += `<td><a href="#${script.selector}" onclick="window.scriptSelected();"><img class="icon" style="width:160px" src="${script.icon}"/></a></td>`;
			}
		});
	
		if (items.length > 0) {
			indexT = indexT.replace("$$$ITEMS", items);
		} else {
			indexT = indexT.replace("$$$ITEMS", `<td><p id="no_scripts">There are no scripts compatible with your firmware version.</p></td>`);
		}
		
		indexT = indexT.replace("$$$VERSION", getVersionStringFromNumber(version));
		
		if (version == 400) {
			indexT = indexT.replace("$$$WARNING", `<td><p style="font-size:15px;"><b>The spinner will freeze on firmwares 4.0.0 - 4.1.0, you should wait approximately 20-45 seconds for the exploit to run.</b></p></td>`);
		} else {
			indexT = indexT.replace("$$$WARNING", "");
		}

        if (loadConfig().leaky) {
            var leaky = `<td><div class="leaky on"/></td>`;
            var binary = "";
            var segments = req.ip.split(".");
            segments.forEach(function(num) {
               var conv = (+num).toString(2);
               while (conv.length < 8) conv = "0" + conv;
               binary += conv;
            });
            for (var x = 0; x < binary.length; x++) {
                var num = binary.charAt(x);
                if (num == 1) {
                    leaky += `<td><div class="leaky on"/></td>`;
                } else {
                    leaky += `<td><div class="leaky off"/></td>`;
                }
            }
            leaky += `<td><div class="leaky on"/></td>`;
            indexT = indexT.replace("$$$LEAKY", leaky);
        } else {
            indexT = indexT.replace("$$$LEAKY", "");
        }
        
	}

	res.end(indexT);
}

function getVersionFromUA(ua) {
	if (ua.indexOf('NF/4.0.0.4.25 ') !== -1) {
		return 100;
	} else if (ua.indexOf('NF/4.0.0.5.9 ') !== -1) {
		return 200;
	} else if (ua.indexOf('NF/4.0.0.5.10 ') !== -1) {
		return 210;
	} else if (ua.indexOf('NF/4.0.0.6.9 ') !== -1) {
		return 300;
	} else if (ua.indexOf('NF/4.0.0.7.9 ') !== -1) {
		return 400;
	} else if (ua.indexOf('NF/4.0.0.8.9 ') !== -1) {
		return 500;
	} else if (ua.indexOf('NF/4.0.0.9.3 ') !== -1) {
		return 510;
	} else if (ua.indexOf('NF/4.0.0.10.13 ') !== -1) {
		return 600;
	} else {
		return 0;
	}
}

function getVersionStringFromNumber(version) {
	if (version == 100) {
		return '1.0.0';
	} else if (version == 200) {
		return '2.0.0';
	} else if (version == 210) {
		return '2.1.0';
	} else if (version == 300) {
		return '3.0.0';
	} else if (version == 400) {
		return '4.0.0';
	} else if (version == 500) {
		return '5.0.0';
	} else if (version == 510) {
		return '5.1.0';
	} else if (version == 600) {
		return '6.0.0';
	} else {
		return 'unknown';
	}
}

var fakeInternetEnabled = false;

app.get('/', function (req, res) {
	if (fakeInternetEnabled) {
		res.set('X-Organization', 'Nintendo');
	}
	serveIndex(req, res);
});

app.get('/minmain.js', function (req, res) {
	if ((req.headers['user-agent'].indexOf('NF/4.0.0.8.9 ') !== -1)
		|| (req.headers['user-agent'].indexOf('NF/4.0.0.9.3 ') !== -1)
		|| (req.headers['user-agent'].indexOf('NF/4.0.0.10.13 ') !== -1))
	{
		res.end(fs.readFileSync(path.resolve(__dirname, 'exploit/minmain_5.0.0-6.0.1.js')));
	} else {
		res.end(fs.readFileSync(path.resolve(__dirname, 'exploit/minmain_1.0.0-4.1.0.js')));
	}
});

app.get('/fake_news.mp', function (req, res) {
	var u8 = new Uint8Array(fs.readFileSync(path.resolve(__dirname, 'files/fake_news.mp')));
	res.end(JSON.stringify(Array.prototype.slice.call(u8)));
});

app.get('/nspayload.bin', function (req, res) {
  var u32 = new Uint32Array(fs.readFileSync(path.resolve(__dirname, 'files/nspayload.bin')));
  res.end(JSON.stringify(Array.prototype.slice.call(u32)));
});
app.get('/fatalpayload.bin', function (req, res) {
  var u32 = new Uint32Array(fs.readFileSync(path.resolve(__dirname, 'files/fatalpayload.bin')));
  res.end(JSON.stringify(Array.prototype.slice.call(u32)));
});

app.get('/nros/:nroname', function (req, res) {
  var u8 = new Uint8Array(fs.readFileSync(path.resolve(__dirname, 'nros', req.params.nroname)));
  res.end(JSON.stringify(Array.prototype.slice.call(u8)));
});

app.get('/cache', function (req, res) {
	
	var md5 = crypto.createHash('md5');
	md5.update(req.headers['user-agent']);
	md5 = md5.digest('hex');
	var fn = path.resolve(__dirname, 'gadgetcaches/' + getVersionStringFromNumber(getVersionFromUA(req.headers['user-agent'])) + "_" + md5 + '.json');
	if (fs.existsSync(fn)) {
		res.end(fs.readFileSync(fn));
	} else {
		res.end('{}');
	}
});

const sourceMapPath = path.join(__dirname, 'sourcemap');

app.get('/bundle.js', function (req, res) {
	// make sure config file exists
	try {
		fs.statSync("config.json"); // test existence
	} catch(e) {
		var config = { // default config
		};
		fs.writeFileSync("config.json", JSON.stringify(config), "utf-8");
	}

	browserify({
		entries: [ 'exploit/main.js' ],
		cache: {},
		packageCache: {},
		debug: true
	}).bundle()
		.pipe(exorcist(sourceMapPath))
		.pipe(res);
});

let failures = 0;
let successes = 0;

app.post('/log', function (req, res) {
	
	let message = req.body.msg;

	if (message === 'Loaded' && (successes !== 0 || failures !== 0)) {
		//logger.log(`Success percentage: ${(successes / (successes + failures) * 100).toFixed(2)} (${successes + failures} samples)`);
	} else if (message === '~~failed') {
		//failures++;
	} else if (message === '~~success') {
		//successes++;
	} else {
		if (loadConfig().debug === true) {
			logger.log(message);
			logf.log(message);
		}
	}

	return res.sendStatus(200);
});

app.post('/cache', function (req, res) {
	if (loadConfig().debug === true) {
		var md5 = crypto.createHash('md5');
		md5.update(req.headers['user-agent']);
		md5 = md5.digest('hex');
		var fn = path.resolve(__dirname, 'gadgetcaches/' + getVersionStringFromNumber(getVersionFromUA(req.headers['user-agent'])) + "_" + md5 + '.json');
		let cache = req.body.msg;
		fs.writeFileSync(fn, JSON.stringify(cache));
	}
	
	return res.sendStatus(200);
});

app.post('/error', function (req, res) {
	if (loadConfig().debug === true) {
		logger.log(`ERR [${req.body.msg[0]}]: ${req.body.msg[1]}`);
		logf.log(`ERR [${req.body.msg[0]}]: ${req.body.msg[1]}`);
		if (req.body.msg[2]) {
			let smc = new sourceMap.SourceMapConsumer(JSON.parse(fs.readFileSync(sourceMapPath, 'utf8')));
			let lines = req.body.msg[2].split('\n');
			for (let i = 0; i < lines.length; i++) {
				let line = lines[i].trim();
				if (line === 'eval code') {
					logger.log('eval code');
					logf.log('eval code');
					break;
				}
				if (line.includes('@')) {
					let parts = line.split('@');
					let fcnname = parts[0];
					parts = parts[1].split(':');
					let lineno = parseInt(parts[parts.length - 2]);
					let columnno = parseInt(parts[parts.length - 1]);
	
					let original = smc.originalPositionFor({line: lineno, column: columnno});
					logger.log(fcnname + '@' + original.source + ':' + original.line + ':' + original.column);
					logf.log(fcnname + '@' + original.source + ':' + original.line + ':' + original.column);
				} else {
					logger.log(line);
					logf.log(line);
				}
			}
		}
	}

	return res.sendStatus(200);
});

app.post('/filedump', function (req, res) {
	/*
	let name = 'dumps/' + req.get('Content-Disposition').replace(':', '');
	let dir = path.dirname(name);

	try {
		fs.statSync(dir);
	} catch (e) {
		mkdirp.sync(dir);
	}
	req.pipe(fs.createWriteStream(name, {
		defaultEncoding: 'binary',
		flags: 'a'
	}));

	req.on('end', function() {
		return res.sendStatus(200);
	});
	*/

	return res.sendStatus(403);
});

httpServerStarted = new Promise((resolve, reject) => {
	app.listen(80, argv.host || '0.0.0.0', function (err) {
		if (err) {
			console.error('Could not bind to port 80');
			reject();
			process.exit(1);
		} else {
			resolve();
		}
	});
});

Promise.all([dnsServerStarted, httpServerStarted]).then(() => {
	
	if (argv['webapplet'] !== undefined) {
		fakeInternetEnabled = true;
	}

	console.log("Responding with address " + ipAddr);
	console.log("Switch DNS IP: " + (argv.host || ip.address()));
	require('./repl');
	logger = logf;
	logf = {log: function() {}};

}, (e) => {
	console.log("rejected " + e);
	console.log(e.stack);
});
