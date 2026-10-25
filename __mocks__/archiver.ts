// Mock archiver for Jest tests
const EventEmitter = require('events')

class MockArchiver extends EventEmitter {
  append(data: any, options: any) {
    return this
  }

  finalize() {
    setTimeout(() => {
      this.emit('data', Buffer.from('MOCK_PKPASS_DATA'))
      this.emit('end')
    }, 0)
    return this
  }
}

module.exports = function archiver(format: string, options?: any) {
  return new MockArchiver()
}

module.exports.create = function(format: string, options?: any) {
  return new MockArchiver()
}
