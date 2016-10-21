var Controller = require('./Controller.js');
var config = require('../config.js');
var toSubmitAt = require('./lib/toSubmitAt.js');
var FilenamesInputParser = require('./lib/FilenamesInputParser.js');
var inquirer = require('inquirer');
var wrapError = require('./wrapError.js');
var text = config.text;
var lang = 'en';

function getMessage(catalog, mcode) {
  return text[catalog][mcode][lang];
}

function setWidth(str, num) {
  return ('000000' + str).slice(-num);
}

function getSeparator() {
  return new inquirer.Separator();
}

function promiseTimeout(promise, time) {
  return new Promise(function(resolve, reject) {
      return setTimeout(function() {
        return promise.then(function() {
            return resolve(false);
        }, function(errs) {
            return reject(errs);
        });
      }, time);
  });
}

var funcMap = {
  "p": {
    "courseMul": false,
    "problemMul": true,
    "submissionMul": false
  },
  "c": {
    "courseMul": false,
    "problemMul": false,
    "submissionMul": false
  },
  "s": {
    "courseMul": false,
    "problemMul": false,
    "submissionMul": true
  }
}
var phaseStack = {
  "storage": [null, {
    "name": 'course',
    "Name": 'Course',
    "nameKey": 'name',
    "idKey": 'courseId',
    "mapFunc": function(one, index, self) {
      return {
        "name": '[' + setWidth(one[phaseStack.storage[1].idKey], self.maxDigitNum) + '] ' + one[phaseStack.storage[1].nameKey],
        "value": one[phaseStack.storage[1].idKey]
      };
    },
    "back": function(multiple, func) {
      phaseStack.pop();
      return UI.selectFunction();
    }
  }, {
    "name": 'problem',
    "Name": 'Problem',
    "nameKey": 'title',
    "idKey": 'ca_id',
    "mapFunc": function(one, index, self) {
      return {
        "name": '[' + setWidth(one[phaseStack.storage[2].idKey], self.maxDigitNum) + '] ' + one[phaseStack.storage[2].nameKey],
        "value": one[phaseStack.storage[2].idKey]
      }
    },
    "back": function(multiple, func) {
      phaseStack.pop(), phaseStack.pop();
      return UI.select(multiple, func);
    }
  }, {
    "name": 'submission',
    "Name": 'Submission',
    "nameKey": 'submit_at',
    "idKey": 'sub_ca_id',
    "mapFunc": function(one, index, self) {
      return {
        "name": '[' + setWidth(one[phaseStack.storage[3].idKey], self.maxDigitNum) + '] ' + toSubmitAt(one[phaseStack.storage[3].nameKey], true),
        "value": one[phaseStack.storage[3].idKey]
      }
    },
    "back": function(multiple, func) {
      phaseStack.pop(), phaseStack.pop();
      return UI.select(multiple, func);
    }
  }, null],
  "p": 0,
  "canPop": function() {
    return this.p;
  },
  "push": function() {
    ++this.p;
    return this.storage[this.p];
  },
  "pop": function() {
    --this.p;
    return this.storage[this.p];
  }
};

var UI = {
  "curUser": {
    "problemType": null,
    "isTA": false
  },
  "start": function() {
    return Controller.init().catch(function(errs) {
      for (var i = 0; i != errs.length; ++i) {
        var oneErr = errs[i];
        if (oneErr.mcode == 'NO_INTERNET_ACCESS') {
          console.log(getMessage('error', 'NO_INTERNET_ACCESS'));
          return Promise.reject(oneErr);
        } else {
          console.log(getMessage('error', oneErr.mcode));
        }
      }
    }).then(function() {
      return UI.selectAccount();
    }).catch(function(errs) {
        return console.log();
    });
  },
  "printErrs": function(errs) {
    if (!Array.isArray(errs)) errs = [wrapError(errs, 'INTERNAL_ERROR')];
    return errs.forEach(function(oneErr) {
      try {
        console.log(getMessage('error', oneErr.mcode));
      } catch (e) {
        console.log('Unexpected Error:', oneErr);
      }
      
    });
  },
  "selectAccount": function() {
    console.log('select account begins');
    var usersList = Controller.getUsersList();
    var hasUsers = !!usersList.length;
    var useNewAccount = getMessage('normal', 'USE_NEW_ACCOUNT');
    usersList.unshift(useNewAccount);
    return inquirer.prompt([{
      "type": 'list',
      "name": 'username',
      "message": 'Please select an account to login, or use a new account',
      "choices": usersList,
      "when": function() {
        return hasUsers;
      }
    }]).then(function(answers) {
       if (!hasUsers || answers.username == useNewAccount) {
         return UI.login();
       } else {
         return UI.login(answers.username);
       }
    }).catch(function(errs) {
        UI.printErrs(errs);
    });;
  },
  "login": function(username) {
    console.log('login starts');
    var fromData = (arguments.length == 1);
    var questions = [{
      "type": 'input',
      "name": 'username',
      "message": 'Username',
      "validate": function(value) {
        return value.length ? true : getMessage('error', 'EMPTY_USERNAME');
      },
      "when": function() {
        return !fromData;
      }
    }, {
      "type": 'password',
      "name": 'password',
      "message": 'Password',
      "validate": function(value) {
        return value.length ? true : getMessage('error', 'EMPTY_PASSWORD');
      },
      "when": function() {
        return !fromData;
      }
    }];
    return inquirer.prompt(questions).then(function(answers) {
        var param = [];
        if (fromData) {
          param.push(username);
        } else {
          param.push(answers.username, answers.password);
        }
        return Controller.login.apply(Controller, param).then(function(data) {
            // console.log('OK', data);
            console.log(getMessage('normal', 'LOGGED_IN_AS')(data.username, data.realname));
            return inquirer.prompt([{
              "type": 'confirm',
              "name": 'saveUser',
              "message": getMessage('question', 'CONFIRM_STORE_USER'),
              "when": function() {
                return !fromData;
              }
            }]).then(function(answers) {
                if (!fromData) {   // new account
                  if (!answers.saveUser) {  // not to store
                    console.log(getMessage('normal', 'NOT_STORED'));
                  } else {
                    Controller.saveUser().then(function() {
                      console.log(getMessage('normal', 'STORED_SUCCESS'));
                    }, function(errs) {
                      UI.printErrs(errs);
                    });
                  }
                }
                return UI.selectFunction();
            });
        }, function(errs) {
            var incorrectCombi = false;
            errs.forEach(function(oneErr) {
              if (oneErr.mcode == 'USER_NOT_FOUND' || oneErr.mcode == 'WRONG_PASSWORD') {
                incorrectCombi = true;
              }
              console.log('Error:', getMessage('error', oneErr.mcode) + '. ' + getMessage('normal', 'TRY_AGAIN'));
            });
            if (fromData && incorrectCombi) {
              Controller.removeUser(param[0]);
            }
            return promiseTimeout(UI.selectAccount(), 1000);
        });
    }).catch(function(errs) {
        UI.printErrs(errs);
    });;
  },
  "logout": function() {
    return Controller.logout().then(function(data) {
      console.log('logged out');
      UI.curUser.isTA = null;
      UI.curUser.problemType = null;
      return promiseTimeout(UI.selectAccount());
    });
  },
  "selectFunction": function() {
    console.log('select functions starts');
    while (phaseStack.canPop()) phaseStack.pop();
    return inquirer.prompt([{
      "type": 'list',
      "name": 'func',
      "message": 'select a function', // getMessage('normal', 'SELECR_FUNCTION')
      "choices": [{
        "name": 'Download Problems',
        "value": 'p'
      }, {
        "name": 'Download Submissions',
        "value": 's'
      }, {
        "name":  'Submit Codes',
        "value": 'c'
      }, {
        "name": 'Logout',
        "value": 'q'
      }]
    }]).then(function(answers) {
      if (answers.func == 'q') {
        return UI.logout();
      } else {
        return UI.select(funcMap[answers.func].courseMul, answers.func);
      }
    }).catch(function(errs) {
        UI.printErrs(errs);
    });
  },
  "select": function(multiple, func) {
    var list = null;
    var phaseInfo = phaseStack.push();
    var nameKey = phaseInfo.nameKey;
    var idKey = phaseInfo.idKey;
    var Name = phaseInfo.Name;
    var name = phaseInfo.name;
    var mapFunc = phaseInfo.mapFunc;
    var back = phaseInfo.back;
    var IdMap = {};
    return Controller['get' + Name + 'sList']().then(function(data) {
    
      if (name == 'problem') {
        list = data.filter(function(one) {
          if ( UI.curUser.isTA || (new Date(one.startdate)).toISOString() <=  (new Date()).toISOString() ) return true;
          return false;
        });
        if (func == 'c') {
          list = list.filter(function(one) {
            if ( (new Date()).toISOString() <  (new Date(one.enddate)).toISOString() ) return true;
            return false;
          });
        }
      } else {
        list = data;
      }
        

      if (list.length == 0) {
        console.log('no ' + name + 's for this account');
        return {"choice": 'b'}
      }
      if (name != 'submission') {
        list.sort(function(a, b) {
          if (a[nameKey] < b[nameKey]) return -1;
          else if (a[nameKey] > b[nameKey]) return 1;
          else return 0;
        });
      }
      
      list['maxDigitNum'] = 0;
      list.forEach(function(one, index, self) {
        var oneDigitNum = String(one[idKey]).length;
        if (oneDigitNum > self.maxDigitNum) {
          self.maxDigitNum = oneDigitNum;
        }
        IdMap[one[idKey]] = one;
      });


      var choices = null;
      if (multiple) {
          choices = [{
            "name": 'Custom',
            "value": 'c'
          }, {
            "name": 'All',
            "value": 'a'
          }];
          if (name == 'problem') {
            choices.splice(1, 0, {
              "name": 'Unfinished',
              "value": 'u'
            });
          }
      } else {
          choices = list.map(mapFunc);
      }
      choices.push(getSeparator(), {
        "name": 'Back',
        "value": 'b'
      }, {
        "name": 'Logout',
        "value": 'o'
      }, getSeparator());

      return inquirer.prompt([{
        "type": 'list',
        "name": 'choice',
        "message": 'select one', //getMessage('normal', cur.messageMcode),
        "choices": choices
      }]);
      
    }).then(function(answers) {
        var choice = answers.choice;
        if (choice == 'b') {
            console.log('back');
            return back(funcMap[func].courseMul, func);
        } else if (choice == 'o') {
            console.log('logout');
            return UI.logout();
        } else {
          if (multiple) {
              return inquirer.prompt([{
                "type": 'checkbox',
                "name": 'choices',
                "message": 'select ' + name + 's',
                "choices": list.map(mapFunc).concat([getSeparator()]),
                "when": (choice == 'c')
              }]).then(function(answers) {
                  var choices = answers.choices;
                  var downloadList = [];
                  if (choice == 'a') {
                      list.forEach(function(one) {
                        downloadList.push({
                          "id": one[idKey],
                          "name": IdMap[one[idKey]][nameKey],
                          "type": one.type
                        });
                      });
                  } else if (name == 'problem' && choice == 'u') {
                      list.forEach(function(one) {
                        if ( (new Date()).toISOString() <  (new Date(one.enddate)).toISOString() ) {
                          downloadList.push({
                            "id": one[idKey],
                            "name": IdMap[one[idKey]][nameKey],
                            "type": one.type
                          });
                        }
                      });
                  } else {
                      choices.forEach(function(oneId) {
                        downloadList.push({
                          "id": oneId,
                          "name": IdMap[oneId][nameKey],
                          "type": IdMap[oneId].type
                        });
                      });
                  }
                  if (func == 'p' || func == 's') {
                    downloadList.type = UI.curUser.problemType;
                    UI.curUser.problemType = null;
                    return Controller['download' + Name + 's'](downloadList).then(function() {
                        console.log('success');
                    }, function(errs) {
                        UI.printErrs(errs);
                    }).then(function() {
                        return UI.selectFunction();
                    });
                  }
                  
              });

          } else {
              return Controller['select' + Name](choice).then(function(data) {
                  // console.log(data);
                  if (name == 'course') {
                        UI.curUser.isTA = null;
                      if (func == 's' || func == 'p' || func == 'c') {
                        UI.curUser.isTA = (data.paramData.role == 'TA');
                        return UI.select(funcMap[func].problemMul, func);
                      }
                  } else if (name == 'problem') {
                      if (func == 's') {
                        UI.curUser['problemType'] = IdMap[choice].type;
                        return UI.select(funcMap[func].submissionMul, func);
                      } else if (func == 'c') {
                        return UI.submitAnswers(IdMap[choice].type);
                      }
                  } else {
                    console.log('?');
                  }
                  
              });
          } 
        }
    });
  },
  "submitAnswers": function(type) {
    console.log('submit answers starts');
    if (type == 'Programming problem') {
      return Controller.getProblemInfo().then(function(data) {
          var filenames = data.ca.config.submission;
          return inquirer.prompt([{
            "type": 'list',
            "name": 'method',
            "message": 'select submit method',
            "choices": [{
              "name": 'submit files in a folder',
              "value": 'f'
            }, {
              "name": 'submit files one by one manually',
              "value": 'm'
            }]
            }]).then(function(answers) {
            var method = answers.method;
            if (method == 'f') {
              return inquirer.prompt([{
                "type": 'input',
                "name": 'folder',
                "message": 'folder',
                "validate": function(value) {
                  return value.length ? true : getMessage('error', 'EMPTY_FOLDER');
                }
              }]).then(function(answers) {
                  var folder = FilenamesInputParser(answers.folder)[0];
                  if (!folder.endsWith('/')) folder += '/';
                  var files = filenames.map(function(one) {
                    return {
                      "name": one,
                      "path": folder + one
                    };
                  });
                  return Controller.submitFiles(files).then(function() {
                    console.log('success');
                    return UI.selectFunction();
                  }, function(errs) {
                    console.log(errs);
                    return UI.submitAnswers(type);
                  });
              }, function(errs) {
                  UI.printErrs(errs);
                  return UI.submitFolder(type);
              }).catch(function(errs) {
                UI.printErrs(errs);
              });
            } else if (method == 'm') {
              return UI.submitFiles(filenames);
            }
          });
      });
    }
  },
  "submitFiles": function(list) {
    var promptList = list.map(function(oneFilename) {
      return {
        "type": 'input',
        "name": oneFilename,
        "message": oneFilename,
        "validate": function(value) {
          return value.length ? true : getMessage('error', 'EMPTY_FILENAME');
        }
      };
    });
    return inquirer.prompt(promptList).then(function(answers) {
      var files = [];
      for (var filename in answers) {
        var path = FilenamesInputParser(answers[filename])[0];
        files.push({
          "name": filename,
          "path": path
        });
      }
      return Controller.submitFiles(files).then(function() {
        console.log('success');
        return UI.selectFunction();
      }, function(errs) {
        UI.printErrs(errs);
        var again = [];
        errs.forEach(function(one) {
          if (one.info && one.info.name) {
            again.push(one.info.name);
          }
        });
        return UI.submitFiles(again);
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
    exports['UI'] = factory();
  else
    root['UI'] = factory();
})(this, function factory() {
  return UI;
});
