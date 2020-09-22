import http from 'http'
import fs from 'fs'
import path from 'path'
import util from 'util'
import url from 'url'
import { Transform } from 'stream'
import zlib from 'zlib'
import crypto from 'crypto'

let { readFile, writeFile, readdir, stat } = fs.promises

import mime from 'mime'
import chalk from 'chalk'
import ejs from 'ejs'
import { deepStrictEqual } from 'assert'

const template = fs.readFileSync(path.resolve(__dirname, '../template.html'), 'utf-8')

export default class Server {
  constructor(config) {
    // console.log(config.port)
    this.port = config.port
    this.template = template
  }
  async handleRequest(req, res) {
    let { pathname } = url.parse(req.url, true)
    pathname = decodeURIComponent(pathname)
    // 当前命令的执行目录
    const filePath = path.join(process.cwd(), pathname)
    try {
      let statObj = await stat(filePath)
      if (statObj.isDirectory()) {
        // console.log('目录')
        const dirs = await readdir(filePath)
        // console.log(dirs)
        let templateStr = ejs.render(this.template, { dirs, path: pathname === '/' ? '' : pathname })
        res.setHeader('Content-Type', 'text/html;charset=utf-8')
        res.end(templateStr)
      } else {
        // console.log('文件')
        this.sendFile(filePath, req, res, statObj)
      }
    } catch (e) {
      this.sendError(e, req, res)
    }
  }
  gzip(filePath, req, res, statObj) {
    let encoding = req.headers['accept-encoding']
    // console.log(encoding)
    if (encoding) {
      if (encoding.match(/gzip/)) {
        res.setHeader('Content-Encoding', 'gzip')
        return zlib.createGzip()
      } else if (encoding.match(/deflate/)) {
        res.setHeader('Content-Encoding', 'deflate')
        return zlib.createDeflate()
      }
      return false
    }
    return false
  }
  cache(filePath, req, res, statObj) {
    const lastModified = statObj.ctime.toGMTString()
    const Etag = crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('base64')
    res.setHeader('Last-Modified', lastModified)
    res.setHeader('Etag', Etag)
    console.log(Etag)
    const ifModifiedSince = req.headers['if-modified-since']
    const ifNoneMatch = req.headers['if-none-match']
    // console.log(Etag)
    if (ifNoneMatch !== Etag) {
      return false
    }



    if (lastModified !== ifModifiedSince) {
      return false
    }


    return true
  }
  sendFile(filePath, req, res, statObj) {
    // console.log(filePath)
    res.setHeader('Cache-Control', 'max-age=10')
    res.setHeader('Expires', new Date(Date.now() + 10 * 1000).toGMTString())
    let cache = this.cache(filePath, req, res, statObj)
    if (cache) {
      res.statusCode = 304
      return res.end()
    }
    let flag = this.gzip(filePath, req, res, statObj)
    const type = mime.getType(filePath) || 'text/plain'
    res.setHeader('Content-Type', type + ';charset=utf-8')
    if (!flag) {
      fs.createReadStream(filePath).pipe(res)
    } else {
      fs.createReadStream(filePath).pipe(flag).pipe(res)
    }
  }
  sendError(e, req, res) {
    console.log(e)
    res.statusCode = 404
    res.end('Not Found')
  }
  start() {
    let server = http.createServer(this.handleRequest.bind(this))
    server.listen(this.port, () => {
      console.log(`${chalk.yellow('Starting up http-server, serving')} ${chalk.blue('./')}
Available on:
   http://127.0.0.1:${chalk.green(this.port)}      
Hit CTRL-C to stop the server
      `)
    })
  }
}
