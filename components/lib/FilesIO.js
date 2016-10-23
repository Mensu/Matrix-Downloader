var mkdirp = require('mkdirp');
var path = require('path');
var osPath = ~process.platform.indexOf('win32') ? path.win32 : path;
var fs = require('fs');

var FilesIO = {
  "read": function(filepath) {
    var self = this;
    return new Promise(function(resolve, reject) {
        return self.stat(osPath.normalize(filepath)).then(function(stat) {
            fs.readFile(osPath.normalize(filepath), 'utf-8', function(err, rawData) {
                if (err) return reject(err);
                else return resolve(rawData.replace(/\r\n/g, '\n'));
            });
        }, function([err, stat]) {
            return reject(err);
        });
    });
  },

  "write": function(filepath, data) {
    return new Promise(function(resolve, reject) {
        return mkdirp(osPath.dirname(filepath), function(err) {
              if (err) return reject(err);
              if (~process.platform.indexOf('win32')) {
                data = data.replace(/\n/g, '\r\n');
              }
              return fs.writeFile(osPath.normalize(filepath), data, function(err) {
                    if (err) return reject(err);
                    else return resolve(false);
              });
        });
    });
  },

  "create": function(filepath, data, overwrite) {
    var self = this;
    if (overwrite) return self.write(filepath, data);
    return self.stat(filepath).then(function(stat) {
          return Promise.resolve(false);
      }, function([err, stat]) {
          if (err.code != 'ENOENT') return Promise.reject(err);
          return self.write(filepath, data).then(function(info) {
              return Promise.resolve(info);
          }, function(err) {
              return Promise.reject(err);
          });
      });
  },

  "stat": function(filepath) {
    return new Promise(function(resolve, reject) {
        fs.stat(path.normalize(filepath), function(err, stat) {
            if (err) return reject([err, stat]);
            else return resolve(stat);
        });
    });
  }
};

(function exportModuleUniversally(root, factory) {
  if (typeof(exports) === 'object' && typeof(module) === 'object')
    module.exports = factory();
  else if (typeof(define) === 'function' && define.amd)
    define(factory);
  /* amd  // module name: diff
    define([other dependent modules, ...], function(other dependent modules, ...)) {
      return exported object;
    });
    usage: require([required modules, ...], function(required modules, ...) {
      // codes using required modules
    });
  */
  else if (typeof(exports) === 'object')
    exports['FilesIO'] = factory();
  else
    root['FilesIO'] = factory();
})(this, function factory() {
  return FilesIO;
});
