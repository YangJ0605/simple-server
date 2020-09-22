"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _http = _interopRequireDefault(require("http"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _util = _interopRequireDefault(require("util"));

var _url = _interopRequireDefault(require("url"));

var _stream = require("stream");

var _zlib = _interopRequireDefault(require("zlib"));

var _crypto = _interopRequireDefault(require("crypto"));

var _mime = _interopRequireDefault(require("mime"));

var _chalk = _interopRequireDefault(require("chalk"));

var _ejs = _interopRequireDefault(require("ejs"));

var _assert = require("assert");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let {
  readFile,
  writeFile,
  readdir,
  stat
} = _fs.default.promises;

const template = _fs.default.readFileSync(_path.default.resolve(__dirname, '../template.html'), 'utf-8');

class Server {
  constructor(config) {
    // console.log(config.port)
    this.port = config.port;
    this.template = template;
  }

  async handleRequest(req, res) {
    let {
      pathname
    } = _url.default.parse(req.url, true);

    pathname = decodeURIComponent(pathname); // 当前命令的执行目录

    const filePath = _path.default.join(process.cwd(), pathname);

    try {
      let statObj = await stat(filePath);

      if (statObj.isDirectory()) {
        // console.log('目录')
        const dirs = await readdir(filePath); // console.log(dirs)

        let templateStr = _ejs.default.render(this.template, {
          dirs,
          path: pathname === '/' ? '' : pathname
        });

        res.setHeader('Content-Type', 'text/html;charset=utf-8');
        res.end(templateStr);
      } else {
        // console.log('文件')
        this.sendFile(filePath, req, res, statObj);
      }
    } catch (e) {
      this.sendError(e, req, res);
    }
  }

  gzip(filePath, req, res, statObj) {
    let encoding = req.headers['accept-encoding']; // console.log(encoding)

    if (encoding) {
      if (encoding.match(/gzip/)) {
        res.setHeader('Content-Encoding', 'gzip');
        return _zlib.default.createGzip();
      } else if (encoding.match(/deflate/)) {
        res.setHeader('Content-Encoding', 'deflate');
        return _zlib.default.createDeflate();
      }

      return false;
    }

    return false;
  }

  cache(filePath, req, res, statObj) {
    const lastModified = statObj.ctime.toGMTString();

    const Etag = _crypto.default.createHash('md5').update(_fs.default.readFileSync(filePath)).digest('base64');

    res.setHeader('Last-Modified', lastModified);
    res.setHeader('Etag', Etag);
    console.log(Etag);
    const ifModifiedSince = req.headers['if-modified-since'];
    const ifNoneMatch = req.headers['if-none-match']; // console.log(Etag)

    if (ifNoneMatch !== Etag) {
      return false;
    }

    if (lastModified !== ifModifiedSince) {
      return false;
    }

    return true;
  }

  sendFile(filePath, req, res, statObj) {
    // console.log(filePath)
    res.setHeader('Cache-Control', 'max-age=10');
    res.setHeader('Expires', new Date(Date.now() + 10 * 1000).toGMTString());
    let cache = this.cache(filePath, req, res, statObj);

    if (cache) {
      res.statusCode = 304;
      return res.end();
    }

    let flag = this.gzip(filePath, req, res, statObj);
    const type = _mime.default.getType(filePath) || 'text/plain';
    res.setHeader('Content-Type', type + ';charset=utf-8');

    if (!flag) {
      _fs.default.createReadStream(filePath).pipe(res);
    } else {
      _fs.default.createReadStream(filePath).pipe(flag).pipe(res);
    }
  }

  sendError(e, req, res) {
    console.log(e);
    res.statusCode = 404;
    res.end('Not Found');
  }

  start() {
    let server = _http.default.createServer(this.handleRequest.bind(this));

    server.listen(this.port, () => {
      console.log(`${_chalk.default.yellow('Starting up http-server, serving')} ${_chalk.default.blue('./')}
Available on:
   http://127.0.0.1:${_chalk.default.green(this.port)}      
Hit CTRL-C to stop the server
      `);
    });
  }

}

exports.default = Server;