var httpRequest = require('./lib/httpRequest.js');
var config = require('../config.js');
var mkdirp = require('mkdirp');
var path = require('path');
var osPath = ~config.os.indexOf('win') ? path.win32 : path;
var fs = require('fs');


/** 
 * parse a string to JSON without throwing an error if failed
 * @param {string} str - string to be parsed
 * 
 * @return {boolean|Object} return JSON object if succeeded, or false if failed
 * independent
 */
function JSONParser(str) {
  var ret = null;
  try {
    ret = JSON.parse(str);
  } catch (e) {
    ret = false;
    // console.log(e);
    // console.log('Error: Failed to parse the following string to JSON');
    // console.log(str);
    return e;
  }
  return ret;
}

/** 
 * @constructor
 * MatrixObject
 * @param {string|Object} newConfigs - Matrix's root url(string) or config object that looks like this:
 * {
 *   "rootUrl": Matrix's root url
 * }
 * 
 * dependent of 
 *   {function} httpRequest
 */
function MatrixObject(configs) {
  this.configs = ['rootUrl', 'googleStyleUrl'];
  for (var i = 0; i != this.configs.length; ++i) {
    var oneConfig = this.configs[i];
    this[oneConfig] = null;
  }
    // wrap to config object
  if (typeof(configs) == 'string') {
    configs = {"rootUrl": configs};
  }
  this.configsSetter(configs);
  if (!this.rootUrl.endsWith('/')) {
    this.rootUrl += '/';
  }
  if (!this.googleStyleUrl.endsWith('/')) {
    this.googleStyleUrl += '/';
  }
}



MatrixObject.prototype = {
  "constructor": MatrixObject,
  "configsSetter": function(newConfigs) {
    for (var i = 0; i != this.configs.length; ++i) {
      var oneConfig = this.configs[i];
      if (newConfigs[oneConfig] !== undefined) this[oneConfig] = newConfigs[oneConfig];
    }
  },

  /** 
   * wrap an xhr request by trying parsing response data as JSON and catching possible errors
   * @param {string} method - 'get' or 'post'
   * @param {string} url - url to send request
   * @param {Object} [param] - parameters
   * 
   * @return {Object} Promise
   * 
   * @private
   * dependent of 
   *   {function} httpRequest
   */
  "request": function(method, url, param) {
    if (!param) param = null;
    return httpRequest(method, url, param)
      .then(function(body) {
          body = JSONParser(body);
          if (body instanceof Error) {
            return Promise.reject(body);
          } else {
            return Promise.resolve(body);
          }
      }, function(err) {
          return Promise.reject(err);
      });
  },

  "download": function(url, dest) {
    return new Promise(function(resolve, reject) {
        mkdirp(osPath.dirname(dest), function(err) {
          if (err) return reject(err);
          var file = fs.createWriteStream(dest);
          var request = httpRequest.request;
          var sendReq = request.get({
            "url": url,
            "headers": {
              "User-Agent": httpRequest.userAgent
            }
          });
          // verify response code
          sendReq.on('response', function(response) {
            if (response.statusCode != 200 && response.statusCode != 304) {
              return reject('Unexpected response code ' + response.statusCode);
            }
          });
          // check for request errors
          sendReq.on('error', function(err) {
            fs.unlink(dest);
            return reject(err);
          });
          sendReq.pipe(file);
          file.on('finish', function() {
            file.close(function() {
              return resolve(false);
            });  // call callback after close completes.
          });
          file.on('error', function(err) {  // Handle errors
            fs.unlink(dest); // Delete the file async.
            return reject(err);
          });
        });
    });
    
  },

  /** 
   * test whether user has internet access to Matrix
   * @return {Object} - Promise
   * @Promise {fullfilled} null
   * @Promise {rejected} true or an error object
   * dependent of 
   *   {function} httpRequest
   */
  "testNetwork": function() {
    return httpRequest('get', this.rootUrl + '/app-angular/course/self/views/list.client.view.html', null)
      .then(function() {
          return Promise.resolve(null);
      }, function(err) {
          return Promise.reject(err);
      });
  },

  /** 
   * get one submission by courseId, problemId and submissionId (sub_ca_id)
   * @param {Object} param - object that looks like this
   *   {
   *     "courseId": the course's id,
   *     "problemId": the assignment's id,
   *     "submissionId": the submission's id,
   *   }
   * dependent of 
   *   {function} this.request
   */
  "getSubmission": function(param) {
      return this.request('get', this.rootUrl + 'api/courses/' + param.courseId + '/assignments/' + param.problemId + '/submissions/' + param.submissionId);
  },

  /** 
   * get the latest report by courseId and problemId
   * @param {Object} param - object that looks like this
   *   {
   *     "courseId": the course's id,
   *     "problemId": the assignment's id
   *   }
   * dependent of 
   *   {function} this.request
   */
  "getLatestReport": function(param) {
    return this.request('get', this.rootUrl + 'api/courses/' + param.courseId + '/assignments/' + param.problemId + '/submissions/last/feedback');
  },

  /** 
   * get the latest submission by courseId and problemId
   * @param {Object} param - object that looks like this
   *   {
   *     "courseId": the course's id,
   *     "problemId": the assignment's id
   *   }
   * dependent of 
   *   {function} this.request
   */
  "getLatestSubmission": function(param) {
    return this.request('get', this.rootUrl + 'api/courses/' + param.courseId + '/assignments/' + param.problemId + '/submissions/last');
  },

  /** 
   * get one problem's information by courseId and problemId
   * @param {Object} param - object that looks like this
   *   {
   *     "courseId": the course's id,
   *     "problemId": the assignment's id
   *   }
   * dependent of 
   *   {function} this.request
   */
  "getProblemInfo": function(param) {
    return this.request('get', this.rootUrl + 'api/courses/' + param.courseId + '/assignments/' + param.problemId);
  },

  /** 
   * get submissions list of a problem by courseId and problemId
   * @param {Object} param - object that looks like this
   *   {
   *     "courseId": the course's id,
   *     "problemId": the assignment's id
   *   }
   * dependent of 
   *   {function} this.request
   */
  "getSubmissionsList": function(param) {
    return this.request('get', this.rootUrl + 'api/courses/' + param.courseId + '/assignments/' + param.problemId + '/submissions' + ((param.isUsingUserId && param.userId) ? '?user_id=' + param.userId : ''));
  },

  /** 
   * log in by username and password
   * @param {Object} param - object that looks like this
   *   {
   *     "username": username,
   *     "passowrd": password
   *   }
   * dependent of 
   *   {function} this.request
   */
  "login": function(param) {
    return this.request('post', this.rootUrl + 'api/users/login', {
      "username": param.username,
      "password": param.password
    });
  },

  /** 
   * log out
   * dependent of 
   *   {function} this.request
   */
  "logout": function() {
    return this.request('get', this.rootUrl + 'api/users/logout');
  },

  /** 
   * get courses list of currect user
   * dependent of 
   *   {function} this.request
   */
  "getCoursesList": function() {
    return this.request('get', this.rootUrl + 'api/courses');
  },

  /** 
   * get one course by courseId
   * @param {Object} param - object that looks like this
   *   {
   *     "courseId": the course's id
   *   }
   * dependent of 
   *   {function} this.request
   */
  "getCourseInfo": function(param) {
    return this.request('get', this.rootUrl + 'api/courses/' + param.courseId + '/description');
  },

  /** 
   * get problems list by courseId
   * @param {Object} param - object that looks like this
   *   {
   *     "courseId": the course's id
   *   }
   * dependent of 
   *   {function} this.request
   */
  "getProblemsList": function(param) {
    return this.request('get', this.rootUrl + 'api/courses/' + param.courseId + '/assignments');
  },

  /** 
   * submit answer by courseId and problemId
   * @param {Object} param - object that looks like this
   *   {
   *     "courseId": the course's id
   *     "problemId": the problem's id
   *     "answers": [{
   *       "name": filename1
   *       "code": code1
   *     }, {
   *       "name": filename2
   *       "code": code2
   *     }]
   *   }
   * dependent of 
   *   {function} this.request
   */
  "submitAnswers": function(param) {
    return this.request('post', this.rootUrl + 'api/courses/' + param.courseId + '/assignments/' + param.problemId + '/submissions', {
      "detail": {
        "answers": param.answers
      }
    });
  },

  "downloadSubmissionFile": function(param) {
    return this.download(this.rootUrl + 'api/courses/' + param.courseId + '/assignments/' + param.problemId + '/submissions/' + param.submissionId + '/download', param.dest);
  },

  "getGoogleStyleReport": function(param) {
    return this.request('post', this.googleStyleUrl + 'api/lint/google-style', param.answers);
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
    exports['MatrixObject'] = factory();
  else
    root['MatrixObject'] = factory();
})(this, function factory() {
  return MatrixObject;
});
