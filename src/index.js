import commander from 'commander'
import Server from './server'

commander.option('-p, --port <val>', 'set http-server port')

commander.parse(process.argv)

let config = {
  port: 8080
}

Object.assign(config, commander)
// console.log(config.port)

let server = new Server(config)

server.start()