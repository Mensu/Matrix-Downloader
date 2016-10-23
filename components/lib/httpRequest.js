var request = require('request');
request = request.defaults({
  "jar": request.jar()
});
var userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36';
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
/** 
 * @description make a simple http request
 * @param {string} method
 * @param {string} url
 * @param {Object} param
 * @param {function(boolean, Object):void} callback - a function that looks like this:
 *      @param {boolean} error
 *      @param {Object} [response] - present when no error occurred
 *   function(error, response) {
 * 
 *   }
 * @return {void}
 * independent
 */
function httpRequest(method, url, param) {
  return new Promise(function(resolve, reject) {
      if (method == 'get') {
          // convert param to ?key1=value1&key2=value2
        var temp = '';
        if (param) {
          for (var key in param) {
            temp += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(param[key]);
          }
          if (temp.length) {
            temp = temp.replace(/^&/, '?');
            if (url[url.lastIndexOf('/') - 1] == '/') url += '/';
            url += temp;
          }
        }
        param = null;
        request.get({
          "url": url,
          "headers": {
            "User-Agent": userAgent
          }
        }, function(error, response, body) {
          if (error) return reject(error);
          else return resolve(body);
        });
      } else if (method == 'post') {
        // param = JSON.stringify(param);
        request.post({
          "url": url,
          "body": param,
          "json": true,
          "headers": {
            "User-Agent": userAgent
          }
        }, function(error, response, body) {
          if (error) return reject(error);
          else return resolve(JSON.stringify(body));
        });
      }
  });
}
httpRequest['request'] = request;
httpRequest['userAgent'] = userAgent; 

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
    exports['httpRequest'] = factory();
  else
    root['httpRequest'] = factory();
})(this, function factory() {
  return httpRequest;
});
