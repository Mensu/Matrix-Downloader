var FilesIO = require('./lib/FilesIO.js');
var wrapError = require('./wrapError.js');

function UsersData(filepath) {
  this['data'] = null;
  this['total'] = 0;
  this['filepath'] = filepath;
  this['template'] = {"users": [], "config": {"ext": {"description": '.md'}}};
}
UsersData.prototype = {
  "constructor": UsersData,
  "write": function() { 
    return FilesIO.write(this.filepath, JSON.stringify(this.data));
  },
  "read": function() {
    var self = this;
    return FilesIO.stat(self.filepath).then(function(stat) {
          // read local file
        return FilesIO.read(self.filepath).then(function(rawData) {

            var toUpdate = false;
            function fixUndefined(toBeFixed, template) {
              for (var key in template) {
                  if (toBeFixed[key] === undefined) {
                      toBeFixed[key] = JSON.parse(JSON.stringify(template[key]));
                      toUpdate = true;
                  } else {
                    var typeInfo = Object.prototype.toString.apply(template[key]);
                    if ( typeInfo != Object.prototype.toString.apply(toBeFixed[key]) ) {
                      toBeFixed[key] = JSON.parse(JSON.stringify(template[key]));
                    } else if ( typeInfo == '[object Object]' || typeInfo == '[object Array]' ) {
                      fixUndefined(toBeFixed[key], template[key]);
                    }
                  }
              }
            }
            
            // construct a usersData object using data from the file
            try {
              self.data = JSON.parse(rawData);
              self.total = 0;
              self.data.users.forEach(function(oneUser, index) {
                  if (oneUser.username.length && oneUser.password.length) {
                      ++self.total;
                  }
              });

              fixUndefined(self.data, self.template);
              if (toUpdate) self.write(self.filepath);

            } catch (e) {
              self.data = JSON.parse(JSON.stringify(self.template));
              self.total = self.data.users.length;
              return Promise.reject(wrapError(e, 'USERS_DATA_DAMAGED'));
            }
            return Promise.resolve(false);

        }, function(err) {
              // create an empty usersData object
            self.data = JSON.parse(JSON.stringify(self.template));
            self.total = self.data.users.length;
            if (err.code == 'ENOENT') return Promise.resolve(false);
            else return Promise.reject(wrapError(err, 'USERS_DATA_DAMAGED'));
        });
    }, function([err, stat]) {
          // create an empty usersData object
        self.data = JSON.parse(JSON.stringify(self.template));
        self.total = self.data.users.length;
        return Promise.resolve(false);
    });
  },
  "getUser": function(username) {
    var index = this.indexOf(username);
    return this.data.users[index];
  },
  "getUsersList": function() {
    return this.data.users.map(function(oneUser) { return oneUser.username; });
  },
  "indexOf": function(username) {
    for (var i = 0; i != this.total; ++i) {
      if (username == this.data.users[i].username) return i;
    }
    return this.total;
  },
  "add": function(username, password) {
    this.data.users[ this.indexOf(username) ] = {
      "username": username,
      "password": password
    }
    ++this.total;
  },
  "remove": function(username) {
    this.data.users[ this.indexOf(username) ] = this.data.users[this.total - 1];
    this.data.users.pop();
    --this.total;
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
    exports['UsersData'] = factory();
  else
    root['UsersData'] = factory();
})(this, function factory() {
  return UsersData;
});
