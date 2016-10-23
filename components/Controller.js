var config = require('../config.js');
var FilesIO = require('./lib/FilesIO.js');
var UsersData = require('./UsersData.js');
var MatrixObject = require('./MatrixObject.js');
var wrapError = require('./wrapError.js');
var ReportObject = require('./ReportObject.js');
var toSubmitAt = require('./lib/toSubmitAt.js');
var FilesDiff = require('./FilesDiff.js');
var matrix = new MatrixObject({
  "rootUrl": config.root,
  "googleStyleUrl": config.googleStyleUrl
});
var usersData = new UsersData(config.usersdataFilename);

function matrixRequestErrorHandler(error, info) {
  if ( !(error instanceof Error) ) return Promise.reject([wrapError(error.msg, error.status, info)]); 
  else if (error.errno == 'ENOTFOUND' || error.errno == 'ETIMEDOUT') return Promise.reject([wrapError(error, 'NO_INTERNET_ACCESS')]);
  else if (error.errno == 'EPROTO') return Promise.reject([wrapError(error, 'INTERNAL_ERROR')]);
  else return Promise.reject([wrapError(error, 'UNEXPECTED_DATA')]);
}


function User() {
  this['username'] = null;
  this['password'] = null;
  this['userId'] = null;

  var _courseId = null;
  var _courseName = null;
  var _problemId = null;
  var _problemName = null;
  
  this['savePath'] = config.savePath;
  this['submissionId'] = null;

  this['problemsInfoCache'] = {};
  this['submissionsListCache'] = {};
  this['answersToSubmit'] = [];

  Object.defineProperties(this, {
    "courseId": {
      "enumerable": true,
      "get": function() {
        return _courseId;
      },
      "set": function(courseId) {
        _courseId = courseId, this.problemId = this.submissionId = null;
        this.savePath = config.savePath + this.username + '/' + _courseId + '/';
      }
    },
    "courseName": {
      "enumerable": true,
      "get": function() {
        return _courseName;
      },
      "set": function(courseName) {
        _courseName = courseName;
        this.savePath = config.savePath + this.username + '/' + _courseId + ' ' + _courseName + '/';
      }
    },
    "problemId": {
      "enumerable": true,
      "get": function() {
        return _problemId;
      },
      "set": function(problemId) {
        _problemId = problemId, this.submissionId = null;
        this.savePath = config.savePath + this.username + '/' + _courseId + ' ' + _courseName + '/' + _problemId + '/';
        this.problemsInfoCache = {};
        this.submissionsListCache = {};
        this.answersToSubmit = [];
      }
    },
    "problemName": {
      "enumerable": true,
      "get": function() {
        return _problemName;
      },
      "set": function(problemName) {
        _problemName = problemName;
        this.savePath = config.savePath + this.username + '/' + _courseId + ' ' + _courseName + '/' + _problemId + ' ' + _problemName + '/';
      }
    },
    "content": {
      "get": function() {
        return {
            "username": this.username,
            "userId": this.userId,
            "courseId": this.courseId,
            "courseName": this.courseName,
            "problemId": this.problemId,
            "problemName": this.problemName,
            "submissionId": this.submissionId,
            "savePath": this.savePath,
          };
      }
    }
  });
}
var paramNames = ['userId', 'courseId', 'courseName', 'problemId', 'problemName', 'submissionId'];

var Controller = {
  "curUser": new User(),
  "init": function() {
      var errors = [];
      return usersData.read().catch(function(err) {
          return errors.push(err);
      }).then(function() {
          return matrix.testNetwork();
      }).then(function() {
          if (errors.length) return Promise.reject(errors);
          return Promise.resolve(false);
      }, function(err) {
          errors.push(wrapError(err, 'NO_INTERNET_ACCESS'));
          return Promise.reject(errors);
      });
  },

  "login": function(username, password) {
      var self = this;
      if (password == undefined) {
        var user = usersData.getUser(username);
        username = user.username;
        password = user.password;
      }
      var param = {
        "username": username,
        "password": password
      };
      return matrix.login(param).then(function(body) {
          if (body.status != 'OK') return matrixRequestErrorHandler(body, {"username": param.username});
          self.curUser.username = username;
          self.curUser.password = password;
          self.curUser.userId = body.data.user_id;
          return Promise.resolve(body.data);
      }, matrixRequestErrorHandler);
  },

  "logout": function() {
    this.curUser = new User();
    return matrix.logout().catch(matrixRequestErrorHandler);
  },

  "getUsersList": function() {
    return usersData.getUsersList();
  },

  "getCurUser": function() {
    return this.curUser;
  },

  "saveUser": function() {
    usersData.add(this.curUser.username, this.curUser.password);
    return usersData.write().catch(function(err) {
      return Promise.reject([wrapError(err, 'FAIL_TO_WRITE')]);
    });
  },

  "removeUser": function(username) {
    usersData.remove(username);
    return usersData.write().catch(function(err) {
      return Promise.reject([wrapError(err, 'FAIL_TO_WRITE')]);
    });
  },

  "hasUser": function() {
    return usersData.getUser(this.curUser.username);
  },

  "getCoursesList": function() {
    var self = this;
    return matrix.getCoursesList().then(function(body) {
        if (body.status != 'OK') return matrixRequestErrorHandler(body, self.curUser.content);
        return Promise.resolve(body.data);
    }, matrixRequestErrorHandler);
  },

  "selectCourse": function(courseId) {
    var self = this;
    self.curUser.courseId = courseId;
    return self.getCourseInfo().then(function(data) {
        self.curUser.courseName = data.name;
        return Promise.resolve(data);
    });
  },

  "getCourseInfo": function(param) {
    var self = this;
    var parameters = self.fillParam(param);
    return matrix.getCourseInfo(parameters).then(function(body) {
        if (body.status != 'OK') return matrixRequestErrorHandler(body, parameters);
        body.data.paramData = body.paramData;
        return Promise.resolve(body.data);
    }, matrixRequestErrorHandler);
  },

  "getProblemsList": function(param) {
    var self = this;
    var parameters = self.fillParam(param);
    return matrix.getProblemsList(parameters).then(function(body) {
        if (body.status != 'OK') return matrixRequestErrorHandler(body, parameters);
        return Promise.resolve(body.data);
    }, matrixRequestErrorHandler);
  },

  "selectProblem": function(problemId) {
    this.curUser.problemId = problemId;
    var self = this;
    var ret = null;
      // if getProblemInfo failed => end
      // if getSubmission failed => end
    return self.getProblemInfo().then(function(data) {
        ret = data;
        self.curUser.problemName = data.title;
        return self.getSubmission(true);
    }).then(function(data) {
        ret.last = data;
        return Promise.resolve(ret);
    });
  },

  "getProblemInfo": function(param) {
    var self = this;
    var parameters = self.fillParam(param);
    return new Promise(function(resolve, reject) {
        var cache = self.curUser.problemsInfoCache[parameters.problemId];
        if (cache) return resolve(cache);

        return matrix.getProblemInfo(parameters).then(function(body) {
            if (body.status != 'OK') return matrixRequestErrorHandler(body, parameters);
            if (body.data.ca) {
              body.data.description = body.data.ca.description;
              body.data.title = body.data.ca.title;
              body.data.file = body.data.file || [];
            }
            self.curUser.problemsInfoCache[parameters.problemId] = body.data;
            return resolve(body.data);
        }, matrixRequestErrorHandler).catch(function(errs) {
            return unexpectedErrHandler(errs, reject);
        });
    });
  },

  "getDescription": function(param) {
    var self = this;
    var parameters = self.fillParam(param);
    return new Promise(function(resolve, reject) {
        var cache = self.curUser.problemsInfoCache[parameters.problemId];
        if (cache) return resolve(cache.description);
        return self.getProblemInfo(param).then(function(data) {
            return resolve(data.description);
        }).catch(function(errs) {
            return unexpectedErrHandler(errs, reject);
        });
    });
  },

  "getSupportFiles": function(param) {
    var self = this;
    var parameters = self.fillParam(param);
    return new Promise(function(resolve, reject) {
        var cache = self.curUser.problemsInfoCache[parameters.problemId];
        if (cache) return resolve(cache.file);
        return self.getProblemInfo(param).then(function(data) {
            return resolve(data.file || []);
        }).catch(function(errs) {
            return unexpectedErrHandler(errs, reject);
        });
    });
  },

  "getSubmissionsList": function(param) {
    var self = this;
    var parameters = self.fillParam(param);
    parameters.isUsingUserId = true;
    return new Promise(function(resolve, reject) {
        var cache = self.curUser.submissionsListCache[parameters.problemId];
        if (cache) return resolve(cache);
        return matrix.getSubmissionsList(parameters).then(function(body) {
            if (body.status != 'OK') return matrixRequestErrorHandler(body, parameters);
            self.curUser.submissionsListCache[parameters.problemId] = body.data;
            return resolve(body.data);
        }, matrixRequestErrorHandler).catch(function(errs) {
            return unexpectedErrHandler(errs, reject);
        });
    });
    
  },

  "selectSubmission": function(submissionId) {
    this.curUser.submissionId = submissionId;
    return this.getSubmission();
  },

  "getSubmission": function(latest, param) {
    var self = this;
    var func = (latest === true ? 'getLatestSubmission' : 'getSubmission');
    var parameters = self.fillParam(param);
    return matrix[func](parameters).then(function(body) {
        if (body.status != 'OK' && body.status != 'SUBMISSION_NOT_FOUND') return matrixRequestErrorHandler(body, parameters);
        var ret = null;
        if (body.data && body.data.answers) {
          ret = body.data;
        } else {
          ret = {"answers": []};
        }
        return Promise.resolve(ret);
    }, matrixRequestErrorHandler).catch(function(errs) {
        return unexpectedErrHandler(errs, reject);
    });
  },

  "getGoogleStyleReport": function(param) {
    return new Promise(function(resolve, reject) {
      return matrix.getGoogleStyleReport({
        "answers": {
          "files": param.answers
        }
      }).then(function(body) {
        if (body.status == 'OK') return resolve(body.data);
        else return resolve(null);
      }, function(err) {
        return resolve(null);
      });
    });
  },

  "submitAnswers": function(answers, param) {
    var self = this;
    var parameters = self.fillParam(param);
    parameters['answers'] = answers;
    return matrix.submitAnswers(parameters).then(function(body) {
        if (body.status != 'OK') return matrixRequestErrorHandler(body, parameters);
        self.curUser.submissionsListCache[parameters.problemId] = null;
        self.curUser.problemsInfoCache[parameters.problemId] = null;
        return self.downloadReport(true, parameters);
    }, matrixRequestErrorHandler).catch(function(errs) {
        return unexpectedErrHandler(errs, reject);
    });
  },

  "downloadDescription": function(param) {
    var self = this;
    var parameters = self.fillParam(param);
    return self.getDescription(parameters).then(function(description) {
        var filepath = self.curUser.savePath;
        if ( Object.prototype.toString.apply(param) == '[object Object]' ) {
          filepath = config.savePath + self.curUser.username + '/' + parameters.courseId + (parameters.courseName ? ' ' + parameters.courseName : '') + '/' + parameters.problemId + (parameters.problemName ? ' ' + parameters.problemName : '') + '/';
        }
        filepath += 'description' + usersData.data.config.ext.description;
        
        return FilesIO.write(filepath, description);
    }).catch(function(err) {
        if (Array.isArray(err)) return Promise.reject(err); 
        else if (!err.mcode) return Promise.reject([wrapError(err, 'FAIL_TO_WRITE')]);
        return Promise.reject([err]);
    });
  },

  "downloadSupportFiles": function(param) {
    var self = this;
    var parameters = self.fillParam(param);
    return new Promise(function(resolve, reject) {
      self.getSupportFiles(parameters).then(function(files) {
          var basePath = self.curUser.savePath;
          if ( Object.prototype.toString.apply(param) == '[object Object]' ) {
            basePath = config.savePath + self.curUser.username + '/' + parameters.courseId + (parameters.courseName ? ' ' + parameters.courseName : '') + '/' + parameters.problemId + (parameters.problemName ? ' ' + parameters.problemName : '') + '/codes/';
          }
          var errors = [];
          if (!files.length) return resolve(false);
          for (var i = 0, finished = 0; i != files.length; ++i) {
            FilesIO.create(basePath + files[i].name, files[i].code).then(function() {
                ++finished;
                if (finished == files.length) {
                  if (errors.length) return reject(errors);
                  return resolve(false);
                }
            }, function(err) {
                ++finished;
                errors.push(wrapError(err, 'FAIL_TO_WRITE'));
                if (finished == files.length) {
                  return reject(errors);
                }
            }).catch(function(errs) {
                return unexpectedErrHandler(errs, reject);
            });
          }
      }).catch(function(err) {
          if (Array.isArray(err)) return reject(err); 
          else if (!err.mcode) return reject([wrapError(err, 'FAIL_TO_WRITE')]);
          return reject([err]);
      });
    });
    
  },

  "downloadAnswers": function(latest, param) {
    var self = this;
    latest = (latest === true);
    var parameters = self.fillParam(param);
      // use callback but not return a thenable object => wrap it with a Promise
    return new Promise(function(resolve, reject) {
        var filenamesList = null;
        return self.getProblemInfo(parameters).then(function(data) {
          filenamesList = data.ca.config.submission;
          return self.getSubmission(latest, parameters);
        }).then(function(data) {
            var answers = data.answers;
            if (0 == answers.length) {
              answers = filenamesList.map(function(one) {
                return {
                  "name": one,
                  "code": ''
                }
              });
            }
            var basePath = self.curUser.savePath + (latest ? '' : 'submissions/' + self.curUser.submissionId + '/') + 'codes/';
            if ( Object.prototype.toString.apply(param) == '[object Object]' ) {
              basePath = config.savePath + self.curUser.username + '/' + parameters.courseId + (parameters.courseName ? ' ' + parameters.courseName : '') + '/' + parameters.problemId + (parameters.problemName ? ' ' + parameters.problemName : '') + '/' + (latest ? '' : 'submissions/' + parameters.submissionId + '/') + 'codes/';
            }
            var errors = [];
            for (var i = 0, finished = 0; i != answers.length; ++i) {
              FilesIO.create(basePath + answers[i].name, answers[i].code).then(function() {
                  ++finished;
                  if (finished == answers.length) {
                    if (errors.length) return reject(errors);
                    return resolve(false);
                  }
              }, function(err) {
                  ++finished;
                  errors.push(wrapError(err, 'FAIL_TO_WRITE'));
                  if (finished == answers.length) {
                    return reject(errors);
                  }
              }).catch(function(errs) {
                  return unexpectedErrHandler(errs, reject);
              });
            }
        }, function(errs) {
            return reject(errs);
        }).catch(function(errs) {
            return unexpectedErrHandler(errs, reject);
        });
    });
  },

  "downloadSubmissionFile": function(latest, param) {
    var self = this;
    latest = (latest === true);
    var parameters = self.fillParam(param);
    return self.getProblemInfo(parameters).then(function(data) {
        parameters['dest'] = data.config.filename;
        if (latest) return self.getSubmissionsList(parameters);
        else return Promise.resolve(data);
    }).then(function(data) {
        if (latest) {
          
          if (data.length == 0) return Promise.resolve(false);
          else parameters.submissionId = data[0].sub_ca_id;
        }
        var basePath = self.curUser.savePath + (latest ? '' : 'submissions/' + self.curUser.submissionId + '/');
        if ( Object.prototype.toString.apply(param) == '[object Object]' ) {
          basePath = config.savePath + self.curUser.username + '/' + parameters.courseId + (parameters.courseName ? ' ' + parameters.courseName : '') + '/' + parameters.problemId + (parameters.problemName ? ' ' + parameters.problemName : '') + '/' + (latest ? '' : 'submissions/' + parameters.submissionId + '/');
        }
        parameters.dest = basePath + parameters.dest;
        return new Promise(function(resolve, reject) {
            matrix.downloadSubmissionFile(parameters).then(function() {
                return resolve(false);
            }, function(err) {
                return reject([wrapError(err, 'FAIL_TO_DOWNLOAD_FILE', parameters)]);
            });
        });
    });

  },

  "downloadReport": function(latest, param) {
    var self = this;
    latest = (latest === true);
    var func = (latest ? 'getLatestSubmission' : 'getSubmission');
    var reportObject = null;
    var errors = [];
    var parameters = self.fillParam(param);
    var submitTime = undefined;
    return matrix[func](parameters).catch(matrixRequestErrorHandler).then(function(body) {
        if (body.status == 'OK' && body.data && (body.data.grade == -1 || body.data.grade === null)) {
          return Promise.reject('under judging');
        } else {
          return Promise.resolve(body);
        }
    }).then(function(body) {
        if (body.status != 'OK' && body.status != 'SUBMISSION_NOT_FOUND') return matrixRequestErrorHandler(body, parameters);
        reportObject = body;
        if (body.data && body.data.answers) {
          return self.getGoogleStyleReport({
            "answers": body.data.answers
          });
        } else {
          return null;
        }
    }).then(function(data) {
        reportObject['google style'] = data;
        return self.getSubmissionsList();
    }).catch(function(errs) {
        if (reportObject) {
          errors = errors.concat(errs);
          return Promise.resolve([]);
        } else {
          return Promise.reject(errs);
        }
    }).then(function(data) {
        if (0 == data.length) {
          submitTime = null;
        } else if (latest) {
            submitTime = toSubmitAt(data[0].submit_at, true);
        } else {
            var submissionId = param.submissionId;
            for (var i = 0; i != data.length; ++i) {
              if (data[i].sub_ca_id == submissionId) {
                submitTime = toSubmitAt(data[i].submit_at, true);
                break;
              }
            }
        }
        return self.getProblemInfo(parameters);
    }).then(function(problemInfo) {
        var googleStyle = reportObject['google style'];
        reportObject = new ReportObject(reportObject);
        reportObject['problemInfo'] = problemInfo.ca.config;
        reportObject.problemInfo['totalPoints'] = problemInfo.ca.config.grading;
        reportObject['submitTime'] = submitTime;
        reportObject['google style'] = googleStyle;
        reportObject.problemInfo.totalPoints['google style'] = 0;
        var fileContent = config.report.beforeTitle
          + 'Submission Report' + config.report.beforeProblemName
          + problemInfo.title + config.report.beforeReportObject
          + 'var reportObject = ' + JSON.stringify(reportObject) + config.report.after;
        var basePath = self.curUser.savePath + (latest ? '' : 'submissions/' + self.curUser.submissionId + '/');
        if ( Object.prototype.toString.apply(param) == '[object Object]' ) {
          basePath = config.savePath + self.curUser.username + '/' + parameters.courseId + (parameters.courseName ? ' ' + parameters.courseName : '') + '/' + parameters.problemId + (parameters.problemName ? ' ' + parameters.problemName : '') + '/' + (latest ? '' : 'submissions/' + parameters.submissionId + '/');
        }
        return FilesIO.write(basePath + 'Report.html', fileContent);
    }).catch(function(errs) {
        var ret = errs;
        if (errs == 'under judging') {
          return new Promise(function(resolve, reject) {
            return setTimeout(function() {
              return self.downloadReport(latest, parameters).then(function() {
                return resolve(false);
              }, function(errs) {
                return reject(errs);
              });
            }, 5000);
          });
        } else if (!Array.isArray(errs)) {
          errors.push(wrapError(errs, 'FAIL_TO_WRITE'));
          ret = errors;
        }
        return Promise.reject(ret);
    }).catch(function(errs) {
      console.log('?', errs);
    });;
  },

  "downloadFilesDiff": function(oldSub, newSub) {
    var self = this;
    var oldFiles = null;
    var newFiles = null;
    var errors = [];

    var oldParam = {
      "courseId": (oldSub && oldSub.courseId) || self.curUser.courseId,
      "problemId": (oldSub && oldSub.problemId) || self.curUser.problemId,
      "submissionId": parseInt(oldSub) || oldSub.submissionId || self.curUser.submissionId
    };
    var newParam = {
      "courseId": (newSub && newSub.courseId) || self.curUser.courseId,
      "problemId": (newSub && newSub.problemId) || self.curUser.problemId,
      "submissionId": parseInt(newSub) || newSub.submissionId || self.curUser.submissionId
    };
    
    var oldId = oldParam.submissionId;
    var newId = newParam.submissionId;

    return self.getSubmission(false, oldParam).then(function(data) {
        oldFiles = data.answers;
        return self.getSubmission(false, newParam);
    }).then(function(data) {
        newFiles = data.answers;
        var filesDiff = new FilesDiff(oldFiles, newFiles);
        filesDiff['configs'] = {
          "stdHeading": String(oldId),
          "yourHeading": String(newId)
        };
        var problemName = self.curUser.problemName;
        if (oldSub.submissionId || newSub.submissionId) {
          problemName = '';
        }
        
        var fileContent = config.filesComparison.beforeTitle
          + oldId + ' vs ' + newId + config.filesComparison.beforeProblemName
          + problemName + config.filesComparison.beforeReportObject
          + 'var filesDiff = ' + JSON.stringify(filesDiff) + config.filesComparison.after;
        var basePath = self.curUser.savePath + 'submissions/comparsions/';
        if (oldSub.submissionId || newSub.submissionId) {
          basePath = config.savePath + '/' + self.curUser.username + '/comparsions/';
        }
        return FilesIO.write(basePath + oldId + ' vs ' + newId + '.html', fileContent);
    }).catch(function(errs) {
        var ret = errs;
        if (!Array.isArray(errs)) {
          errors.push(wrapError(errs, 'FAIL_TO_WRITE'));
          ret = errors;
        }
        return Promise.reject(ret);
    });
  },

  "downloadOneProblem": function(param) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var finish = 0;
        var expectedFinish = 1;
        var errors = [];
        var type = param.type;
        function errorsHandler(errs) {
          ++finish;
          errors = errors.concat(errs);
          if (finish == expectedFinish) return reject(errors);
        }
        function successHandler() {
          ++finish;
          if (finish == expectedFinish) {
            if (errors.length) return reject(errors);
            return resolve(false);
          }
        }
        if (type == 'Programming problem') {
          expectedFinish = 4;
          self.downloadSupportFiles(param).then(successHandler, errorsHandler);
          self.downloadAnswers(true, param).then(successHandler, errorsHandler);
          self.downloadReport(true, param).then(successHandler, errorsHandler);
        } else if (type == 'Fileupload problem') {
          expectedFinish = 2;
          self.downloadSubmissionFile(true, param).then(successHandler, errorsHandler);
        }
        self.downloadDescription(param).then(successHandler, errorsHandler);

    });
  },

  "downloadOneSubmission": function(param) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var finish = 0;
        var expectedFinish = 1;
        var errors = [];
        var type = param.type;
        function errorsHandler(errs) {
          ++finish;
          errors = errors.concat(errs);
          if (finish == expectedFinish) return reject(errors);
        }
        function successHandler() {
          ++finish;
          if (finish == expectedFinish) {
            if (errors.length) return reject(errors);
            return resolve(false);
          }
        }
        if (type == 'Programming problem') {
          expectedFinish = 2;
          self.downloadAnswers(false, param).then(successHandler, errorsHandler);
          self.downloadReport(false, param).then(successHandler, errorsHandler);
        } else if (type == 'Fileupload problem') {
          self.downloadSubmissionFile(false, param).then(successHandler, errorsHandler);
        }
        
    });
  },

  "downloadProblems": function(list) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var finish = 0;
        var errors = [];
        var downloadQueue = new DownloadQueue(5);
        for (var i = 0; i != list.length; ++i) {
            let index = i;
            downloadQueue.add(function() {
                return self.downloadOneProblem({
                  "courseId": list.courseId,
                  "courseName": list.courseName,
                  "problemId": list[index].id,
                  "problemName": list[index].name,
                  "type": list[index].type
                }).then(function() {
                    ++finish;
                    if (finish == list.length) {
                      if (errors.length) return reject(errors);
                      return resolve(false);
                    }
                }, function(errs) {
                    ++finish;
                    errors = errors.concat(errs);
                    if (finish == list.length) return reject(errors);
                }).catch(function(errs) {
                  unexpectedErrHandler(errs, reject);
                });
            });
        }
    });
  },

  "downloadSubmissions": function(list) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var finish = 0;
        var errors = [];
        var downloadQueue = new DownloadQueue(2);
        for (var i = 0; i != list.length; ++i) {
            let index = i;
            downloadQueue.add(function() {
                return self.downloadOneSubmission({
                  "courseId": list.courseId,
                  "courseName": list.courseName,
                  "problemId": list.problemId,
                  "problemName": list.problemName,
                  "submissionId": list[index].id,
                  "type": list.type
                }).then(function() {
                    ++finish;
                    if (finish == list.length) {
                      if (errors.length) return reject(errors);
                      return resolve(false);
                    }
                }, function(errs) {
                    ++finish;
                    // console.log('Errors!!: ', errs);
                    errors = errors.concat(errs);
                    if (finish == list.length) return reject(errors);
                }).catch(function(errs) {
                  unexpectedErrHandler(errs, reject);
                });
            });
        }
    });
  },

  "submitFiles": function(files) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var total = files.length;
      var finish = 0;
      var errors = [];
      files.forEach(function(oneFile) {
        FilesIO.read(oneFile.path).then(function(data) {
          ++finish;
          self.curUser.answersToSubmit.push({
            "name": oneFile.name,
            "code": data
          });
          if (finish == total) {
            if (errors.length) return reject(errors);
            else return resolve(self.submitAnswers(self.curUser.answersToSubmit));
          }
        }, function(err) {
          ++finish;
          errors.push(wrapError(err, 'FAIL_TO_READ', oneFile));
          if (finish == total) return reject(errors);
        }).catch(function(errs) {
          unexpectedErrHandler(errs);
        });
      });
    });
  },

  "fillParam": function(param) {
    var parameters = {};
    var self = this;
    paramNames.forEach(function(one) {
      parameters[one] = (param && param[one]) || self.curUser[one];
    });
    return parameters;
  }

};

function DownloadQueue(maxNum) {
  this['queue'] = [];
  this['maxNum'] = maxNum;
}
DownloadQueue.prototype = {
  "add": function(func) {
    this.queue.push(func);
    if (!this.working) this.work();
  },
  "working": false,
  "work": function() {
    var self = this;
    self.working = true;
    var jobs = self.queue.slice(0, self.maxNum);
    var promises = [];
    for (var i = 0; i < jobs.length; ++i) {
      promises.push(jobs[i]());
    }
    Promise.all(promises).then(function() {
      self.queue.splice(0, jobs.length);
      if (self.queue.length) self.work();
      else self.working = false;
    });
  }
};



function unexpectedErrHandler(errs, reject) {
  if (!Array.isArray(errs)) {
    return reject([wrapError(errs, 'UNEXPECTED_ERR')]);
  } else {
    return reject(errs);
  }
}

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
    exports['Controller'] = factory();
  else
    root['Controller'] = factory();
})(this, function factory() {
  return Controller;
});
