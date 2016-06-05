var windows32 = false;
var windows = false;
var ByEncloseJS = false;
var chinese = true;

var sanitize = require('sanitize-filename');
var request = require('request');
var j = request.jar();
var request = request.defaults({ jar: j });
var mkdirp = require('mkdirp');
var prompt = require('prompt');
var jsdom = require('jsdom');
var util = require('util');
var path = require('path');
var getDirName = path.dirname;
var fs = require('fs');
var crypto = require('crypto');
var sprintf = require('sprintf-js').sprintf;

var matrixRootUrl = 'https://eden.sysu.edu.cn';
var usersdataFilename = '.usersdata';
var username = '', userId = '', usersDataManager = null, savePath = './saved';

function getMD5(data) { return crypto.createHash('md5').update(data).digest('hex'); }

function writeFile(path, contents, callback) {
  mkdirp(getDirName(path), function(err) {
    if (err) {
      if (callback) return console.log('\nError: ', err.message), callback(err);
      else throw err;
    }
    if (windows) contents = contents.replace(/\n/g, '\r\n');
    fs.writeFile(path, contents, function(err) {
      if (err) {
        if (callback) return console.log('\nError: ', err.message), callback(err);
        else throw err;
      }
      else if (callback) return callback(null);
    });
  });
}

function jQexec(body, cb) {
  jsdom.env({
    html: body,
    scripts: [matrixRootUrl + '/static/js/jquery-1.8.3.min.js'],
    done: cb
  });
}

function connectionFailed() {
  if (chinese) {
    console.log("\n连接错误: 无法连接到Matrix，请稍后再试:(");
    console.log("  *** 这可能是因为您的电脑没有连网，或者TA叶嘉祺正在更新代码。");
  } else {
    console.log("\nConnectionError: Failed to connect to Matrix, please try again later:(");
    console.log("  *** Lack of access to internet or TA Ye Jiaqi being updating codes \
may cause this problem. ");
  }
}

function encloseJSWarning() {
  if (ByEncloseJS) {
    if (chinese) console.log('\n*** 警告: 该可执行文件由EncloseJS免费版编译，在进程工作时间\
方面有较大的限制。因此，若一次性下载过多作业，有些作业的代码和标程二进制文件很有可能无法完整下载。\
此时我们建议您下载该程序的源代码并在nodejs上运行。您可以查看Github上的README文件来获取更多信息。\n');
    else console.log('\n*** WARNING: the executable is compiled by EncloseJS Evaluation version with \
considerable limitations on process working time. Some assignments and binaries are likely to \
fail to be downloaded completely due to these limitations if too many assignments are required \
at a time. In this case we suggest you download the source code and run it on nodejs. \
You might want to check out the README file on our GitHub (https://github.com/Men\
su/eden-asgn-batchdl-nodejs) for more information.\n');
  }
}

function downloadFile(url, dest, callback) {
  mkdirp(getDirName(dest), function(err) {
    if (err) {
      if (callback) return console.log('', err.message, '\n  ... Error occurred when downloading ' + dest), callback(err);
      else throw err;
    }
    var file = fs.createWriteStream(dest);
    var sendReq = request.get(url);
    // verify response code
    sendReq.on('response', function(response) {
      if (response.statusCode !== 200)
        return console.log('', 'Response status was ' + response.statusCode, '\n  ... Error occurred when downloading ' + dest), callback(new Error('Bad Response status' + response.statusCode));
    });
    // check for request errors
    sendReq.on('error', function(err) {
      fs.unlink(dest);
      if (callback) return console.log('', err.message, '\n  ... Error occurred when downloading ' + dest), callback(err);
    });
    sendReq.pipe(file);
    file.on('finish', function() {
      file.close(callback);  // call callback after close completes.
    });
    file.on('error', function(err) {  // Handle errors
      fs.unlink(dest); // Delete the file async.
      if (callback) return console.log('', err.message, '\n  ... Error occurred when downloading ' + dest), callback(err);
    });
  });
};

function fetchLatestSubmissionOutput(problemId, foldername, callback) {
  request.get(matrixRootUrl + '/get-last-submission-report?problemId=' + problemId + '&userId=' + userId, function(e, r, body) {
    if (body.err) {
      console.log('\nError:', body.msg);
      if (callback) return callback(body.err);
      else throw body.err;
    }
    body = JSON.parse(body);
    var data = body.data[0], content = '';;
    if (!data) {
      if (callback) return callback(null);
      else return;
    }
    var grade = data.grade, report = JSON.parse(data.report);
    if (!report) {
      if (callback) return callback(null);
      else return;
    }

    // console.log(report);

    var wrap = function(str, append) { return ((typeof(str) != 'undefined') ? (str + ((typeof(append) != 'undefined') ? append : '')) : 'missing\n'); };
    var wrapBorder = function(str, borderSpaceNum) {
      var border = ' '.repeat(borderSpaceNum) + '+-----------------------------------\n';
      return border + str + border;
    };
    var polishTests = function(tests, std) {
      var prefix = (std) ? 'Standard' : 'Random', noNewLine = '(No \\n at the end)', hasNewLine = '(Has \\n at the end)';
      var polish = function(ac) {
        for (i in tests) {
          //tests[0] = JSON.parse('{"memoryused":6044,"result":"WA","standard_stdout":"2000/06/10-23:30:32 : smyfeobsiwcyjd\\n2006/05/18-23:44:38 : iqfmacdidhxavuttvunaewlngzkzrcswyslobffp\\n2010/05/01-17:00:03 : goyzcfacjvybbusdxttzbqrzbz\\n2018/09/13-05:42:02 : newxqoeeeigqm\\n2018/10/08-16:55:36 : erffudcvxsyfkbnvyc\\n2021/06/19-01:35:17 : ccymckbipr\\n2023/10/10-02:32:23 : lvfxerxksckmsbctyjmzjovkdhoqlkqngvkzg\\n2027/06/18-21:35:34 : glhrly\\n2027/12/28-23:54:00 : glahyskqprdjjvjxuvzvsxmm\\n2034/07/04-02:12:06 : tyvuzubhw\\n2036/01/2sad5-15:02:08 : tytttpzyplzwfxwhjeqfrbfwrseepsjbkyyuce\\n2045/07/21-23:31:31 : dvqdrozllatdkqft\\n2052/08/06-22:34:29 : kahsmvbhjrqtsivcy\\n2062/11/02-04:46:55 : ozrpkoochkgkawkggrcdf\\n2064/12/12-07:18:31 : lmisrmmswjmoovnoqisqinknuyo\\n2070/04/24-21:04:15 : mfkenostccdfapsqjlksny\\n2082/03/10-02:25:07 : hyci\\n2094/03/18-11:16:31 : bimfyz\\n2096/08/08-13:27:30 : hmvthlqlgbwrusxdbusju","stdin":"19\\n2027/06/18-21:35:34|glhrly\\n2023/10/10-02:32:23|lvfxerxksckmsbctyjmzjovkdhoqlkqngvkzg\\n2094/03/18-11:16:31|bimfyz\\n2010/05/01-17:00:03|goyzcfacjvybbusdxttzbqrzbz\\n2018/09/13-05:42:02|newxqoeeeigqm\\n2070/04/24-21:04:15|mfkenostccdfapsqjlksny\\n2062/11/02-04:46:55|ozrpkoochkgkawkggrcdf\\n2096/08/08-13:27:30|hmvthlqlgbwrusxdbusju\\n2045/07/21-23:31:31|dvqdrozllatdkqft\\n2006/05/18-23:44:38|iqfmacdidhxavuttvunaewlngzkzrcswyslobffp\\n2034/07/04-02:12:06|tyvuzubhw\\n2064/12/12-07:18:31|lmisrmmswjmoovnoqisqinknuyo\\n2018/10/08-16:55:36|erffudcvxsyfkbnvyc\\n2000/06/10-23:30:32|smyfeobsiwcyjd\\n2052/08/06-22:34:29|kahsmvbhjrqtsivcy\\n2021/06/19-01:35:17|ccymckbipr\\n2036/01/25-15:02:08|tytttpzyplzwfxwhjeqfrbfwrseepsjbkyyuce\\n2027/12/sda28-23:54:00|glahyskqprdjjvjxuvzvsxmm\\n2082/03/10-02:25:07|hyci\\n","stdout":"2000/06/10-23:30:32 : smyfeobsiwcyjd\\n2006/05/18-23:44:38 : iqfmacdidhxavuttvunaewlngzkzrcswyslobffp\\n2010/05/01-17:00:03 : goyzcfacjvybbusdxttzbqrzbz\\n2018/09/13-05:42:02 : newxqoeeeigqm\\n2018/10/08-16:55:36 : erffudcvxsyfkbnvyc\\n2021/06/19-01:35:17 : ccymckbipr\\n2023/10/10-02:32:23 : lvfxerxksckmsbctyjmzjovkdhoqlkqsngvkzg\\n2027da/06/18-21:35:34 : glhrly\\n2027/12/28-23:54:00 : glahyskqprdjsdadjvjxuvzvsxmm\\n2034/07/04-02:12:06 : tyvuzubhw\\n2036/01/25-15:02:08 : tytttpzyplzwfxwhjeqfrbfwrseepsjbkyyuce\\n2045/07/21-23:31:31 : dvqdrozllatdkqft\\n20dsad52/08/06-22:34:29 : kahsmvbhjrqtsivcy\\n2062/11/02-04:46:55 : ozrpkoochkgkawkggrcdf\\n2064/12/12-07:18:31 : lmisrmmswjmoovnoqisqinknuyo\\n2070/04/24-21:04:15 : mfkenostccdfapsqjlksny\\n2082/03/10-02:25:07 : hyci\\n2094/03/18-11:16:31 : bimfyz\\n2096/08/08-13:27:30 : hmvthlqlgbwrusxdbusju\\n","timeused":0}');

          var wrapStdin = function(str) {
            if (str.length == 0) return "(No input)\n";
            else if (str[str.length - 2] != '\n') str += (noNewLine + '\n');
            else return str;
          };
          var stdContent = null, yourContent = null;
          var addLinenum = function(str, your) {
            var prefix = ((your) ? 'Your ' : ' Std ');
            if (str == 'missing\n') return '********* missing\n';
            else if (str.length == 0) return "********* (No output)\n";
            var length = str.length, ret = '', endWithNewLine = false, moreData = false;
            if (str.match(/ more data\.\.\.$/)) str = str.substring(0, str.length - 14), moreData = true;
            if (str[length - 1] == '\n') endWithNewLine = true;
            str = str.split('\n');
            for (i in str) ret += sprintf(prefix + '%03d |', parseInt(i) + 1) + str[i] + '\n';
            if (!endWithNewLine) {
              ret += prefix + '    |';
              if (moreData) ret += ' more data...\n'
              else ret += noNewLine + '\n';
            }
            if (typeof(your) == 'boolean') {
              if (your) yourContent = ret.split('\n');
              else stdContent = ret.split('\n');
            }
            return ret;
          };
          var difference = function() {
            var ret = '';
            if (!stdContent || !yourContent) return ret;
            if (stdContent.length == yourContent.length) {
              for (i in stdContent) {
                var std = stdContent[i], your = yourContent[i];
                if (std.substr(10) != your.substr(10)) {
                  if (i == stdContent.length - 2) {
                      if (~std.indexOf(noNewLine)) {
                      your += hasNewLine;
                    } else if (~your.indexOf(noNewLine)) {
                      std += hasNewLine;
                    }
                  }
                  ret += std + '\n' + your + '\n         |\n';
                }
              }
            } else {
              var small = (stdContent.length < yourContent.length) ? stdContent : yourContent;
              for (i in small) {
                var std = stdContent[i], your = yourContent[i];
                if (std.substr(10) != your.substr(10)) {
                  ret += std + '\n' + your + '\n';
                  ret += '*********|(difference appears from here...)\n';
                  break;
                }
              }
            }
            return ret;
          }
          var test = tests[i], resultCode = test.result;
          if (ac) {
            if (resultCode != 'CR') continue;
          } else {
            if (resultCode == 'CR') continue;
          }
          var memory = test.memoryused, time = test.timeused;
          var stdin = test.stdin, standard_stdout = test.standard_stdout, stdout = test.stdout;
          content += '\n============ ' + prefix + ' Test #' + (parseInt(i) + 1) + ' ===============\n';
          content += 'Result code: ' + wrap(resultCode) + '\n';
          content += 'Memory used: ' + wrap(memory, 'KB') + '  Time used: ' + wrap(time, 'ms') + '\n\n';
          content += ' Test input:\n' + wrapBorder(wrapStdin(wrap(stdin, '\n'), 0)) + '\n';
          if (ac) {
            content += '          Answer:\n' + wrapBorder(addLinenum(wrap(stdout)), 9) + '\n';
          } else {
            content += '          Standard answer:\n' + wrapBorder(addLinenum(wrap(standard_stdout), false), 9) + '\n';
            content += '          Your answer:\n' + wrapBorder(addLinenum(wrap(stdout), true), 9) + '\n';
            var diff = difference();
            if (diff) content += '          Difference:\n' + wrapBorder(diff, 9);
          }
          // if (~stdLine && stdLine == yourLine) console.log(stdLine, yourLine);
          // if (i == 0) console.log(resultCode, memory, time, stdin, standard_stdout, stdout);
        }
      };
      polish(false);
      polish(true);
    };
    var polishMemoryTests = function(info) {
      // not supported for the moment
    };
    var toContinue = true;
    var polishCompileMsg = function(info) { content += info + '\n'; };
    var polishStandardTests = function(info) { polishTests(info, true); };
    var polishRandomTests = function(info) { polishTests(info, false); };
    var polishPhase = function(phase, func) {
      if (toContinue && report[phase] && report[phase][phase]) {
        toContinue = report[phase]['continue'];
        content += '\n>>>>>>>>>>>>>>>>>> [' + phase + '] <<<<<<<<<<<<<<<<<<<<<<<\nGrade: ' + report[phase]['grade'] + '\n';
        return func(report[phase][phase]);
      } else {
        return;
      }
    };
    var phases = [{'name': 'compile check',
                  'func': polishCompileMsg},
                  {'name': 'standard tests',
                  'func': polishStandardTests},
                  {'name': 'random tests',
                  'func': polishRandomTests},
                  {'name': 'memory check',
                  'func': polishMemoryTests}];
    for (i in phases) polishPhase(phases[i].name, phases[i].func);
    // console.log(content);
    writeFile(savePath + '/' + foldername + '/' + 'Latest Submission Output.txt', content, function(err) {
      if (err) {
        if (callback) return callback(err);
      } else {
        if (callback) return callback(null);
      }
    });
  });
}


function downloadStandardAnswerBinaries(Id, savePath, callback) {
  // if (!globalDownloadBinaries) return callback(null);
  // var subfolder = 'Standard Answer Binaries/', filename = 'a.out';
  // var error = null;
  // downloadFile(edenPrefix + 'linux64/' + Id, savePath + subfolder + 'linux64-'
  //               + filename, function(err) {
  //   if (err) error = err;
  //   if (!windows32) downloadFile(edenPrefix + 'win64/' + Id, savePath + subfolder + 'win64-'
  //                 + filename, function(err) {
  //       if (err) error = err;
  //       if (globalAutomode) {
  //         if (callback) return callback(error);
  //       } else downloadFile(edenPrefix + 'win32/' + Id, savePath + subfolder
  //                     + 'win32-' + filename, function(err) {
  //           if (err) error = err;
  //         // seems that linux 32bit compiler on eden has been out of work
  //         //downloadFile(edenPrefix + 'linux32/' + Id, savePath + subfolder + 'linux64-' + filename, function() {callback();});
  //           return callback(error);
  //         });
  //     });
  //   else downloadFile(edenPrefix + 'win32/' + Id, savePath + subfolder + 'win32-'
  //                 + filename, function(err) {
  //       if (err) error = err;
  //       if (globalAutomode) {
  //         if (callback) return callback(error);
  //       } else downloadFile(edenPrefix + 'win64/' + Id, savePath + subfolder
  //                       + 'win64-' + filename, function(err) {
  //           if (err) error = err;
  //           return callback(error);
  //         });
  //     });
  // });
}

function FetchOne(Id, tobeDone, idArray, callback) {
  request.get(matrixRootUrl + '/get-problem-by-id?problemId=' + Id, function(e, r, body) {
    if (e) {
      connectionFailed(e);
      throw e;
    }
    body = JSON.parse(body);
    if (body.err) {
      console.log('\nError:', body.msg);
      return informFetchResult(body.err, Id);
    }
    var data = body.data, config = JSON.parse(data.config), supportFiles = data.supportFiles;
    console.log(data);
    var title = data.title, c11 = false;
    if (config.compilers['c++']) c11 = Boolean(~config.compilers['c++'].command.indexOf('-std=c++11'));
    var author = data.author, memoryLimit = config.limits.memory + 'MB', timeLimit = config.limits.time + 'ms';
    // console.log(c11, "s\n", config, "s\n", supportFiles, "s\n", author, memoryLimit, timeLimit);
    var error = null;
    // if (tobeDone) console.log(((chinese) ? "正在获取未完成的 Assignment" : "Fetching unfinished assignment"), Id, "....");
    // else console.log(((chinese) ? "正在获取 Assignment" : "Fetching assignment"), Id, "....");
    fetchLatestSubmissionOutput(Id, Id + ' ' + title, function(err) {
      if (err) error = err;
      informFetchResult(error, Id);
      if (callback) return callback();
    });
    return;
    
//         // it would be better to encapsulate this section as an exception
//       if (blockTag.length == 0) {
//         if (chinese) {
//           console.log("\n错误：页面上没有代码文件 (出错的id为" + Id + ")");
//           console.log("  *** 建议您亲自登录Eden查看该作业是否真实存在、正在改分、或者被判抄袭。");
//           if (~$('#main font').text().indexOf('plagiarism')) console.log('  *** 提示：您的这次作业似乎被判了抄袭。');
//           console.log('  ... 下载 Assignment ' + Id + ' 时出错。');
//         } else {
//           console.log("\nError: No code files exist. (the assignment id is " + Id + ")");
//           console.log("  *** It is suggested that you check out whether the assignment actually exists, \
// is being graded, or is in plagiarism pending.");
//           if (~$('#main font').text().indexOf('plagiarism')) console.log('  *** Hint: Your assignment seems to be in plagiarism pending.');
//           console.log('  ... There occurred some problems when Assignment ' + Id + ' are being downloaded.');
//         }
//         return;
//       }

  });
}

function informFetchResult(error, Id) {
  if (chinese) {
    if (error) console.log('  ... 下载 Assignment ' + Id + ' 时出错。');
    else console.log('  ... 成功下载 Assignment ' + Id + '!');
  } else {
    if (error) console.log('  ... There occurred some problems when Assignment ' + Id + ' are being downloaded.');
    else console.log('  ... Assignment ' + Id + ' downloaded successfully!');
  }
}

// function fetchAsgn(idArray) {
//   var task = null;
//   for (var i = 0; i < 2; ++i) {
//     if (idArray.length == 0) return;
//     task = idArray.pop();
//     FetchOne(task[0], task[1], task[2], task[3], idArray);
//   }
//   if (idArray.length == 0) return;
//   task = idArray.pop();
//   FetchOne(task[0], task[1], task[2], task[3], idArray, fetchAsgn);
// }

// function fetchUnfinished(username, idArray, callback) {
  // request.get(edenPrefix + 'ass/', function(e, r, body) {
  //   if (e) {
  //     connectionFailed(e);
  //     throw e;
  //   }
  //   jQexec(body, function(err, window) {
  //       var $ = window.$;
  //       informServerError($);
  //       if ($('.item-ass a').length > 6) encloseJSWarning();
  //       $('.item-ass a').each(function(index) {
  //           // sanitize id and title
  //         Id = $(this).attr('href').replace(/[^0-9]/g, '');
  //         Title = $(this).text().replace(/^\s+/, '').replace(/\s+$/, '');
  //         if (idArray && callback) {
  //           idArray.push([Id, false, Title, username]);
  //           if (index == $('.item-ass a').length - 1) callback(idArray);
  //         } else FetchOne(Id, false, Title, username);
  //       });
  //   });
  // });
// }

function UsersDataManager(filename, callback) {
    // this => *this && public
  this.data = {"users": []};
  this.total = 0;
  var self = this;
  UsersDataManager.prototype.readDataFrom = function(filename, callback) {
    fs.exists(filename, function(exist) {
      if (!exist) {
          // create an empty usersDataManager object
        self.data = {"users": []};
        self.total = self.data.users.length;
        if (callback) callback(null);
      } else {
          // read the file
        fs.readFile(filename, 'utf-8', function(err, rawData) {
          if (err) {
            if (callback) console.log('', err.message), callback(err);
            else throw err;
          } else {
              // create a usersDataManager object from the file
            try {  
              self.data = JSON.parse(rawData);
              self.total = 0;
              for (i in self.data.users) 
                if (self.data.users[i].username.length && self.data.users[i].password.length) ++self.total;
            } catch (e) {
              console.log('', e.name + ": " + e.message);
              if (chinese) console.log('  *** 错误：' + filename + ' 文件似乎被修改过，无法被解释器识别了。\
原来的 ' + filename + ' 文件将会在下一次储存用户名密码的时候被覆盖。');
              else console.log('  *** Error: It seems that data stored in ' + filename + ' have \
been modified and could not be recognized any more. \
The orginal ' + filename + ' file will get overwritten when \
new username and password patterns are allowed to stored.');
              self.data = {"users": []};
              self.total = self.data.users.length;
              if (callback) return callback(null);
              else throw e;
            }
            if (callback) callback(null);
          }
        });
      }
    });
  };
  UsersDataManager.prototype.writeDataTo = function(filename, callback) {
    fs.writeFile('./' + filename, JSON.stringify(this.data), function() {
      if (callback) callback(null);
    });
  };
  UsersDataManager.prototype.listUsernames = function() {
    for (var i = 0; i < this.total; ++i) {
      console.log('[' + (parseInt(i) + parseInt(1)) + ']', this.data.users[i].username);
    }
  };
  UsersDataManager.prototype.findAccountByUsername = function(username) {
    for (var i = 0; i < this.total; ++i) {
      if (username == this.data.users[i].username) return i;
    }
      // not found: return a new index which makes it convenient to create new accounts
    return this.total;
  };
  UsersDataManager.prototype.addAccount = function(username, password) {
    this.data.users[this.findAccountByUsername(username)] = {
      "username": username,
      "password": password
    }
    ++(this.total);
  };
  UsersDataManager.prototype.getAccountByListedIndex = function(index) {
    if (1 <= index && index <= this.total) return this.data.users[index - 1];
    else return {'username': '', 'password': ''};
  };
  UsersDataManager.prototype.removeAccountByUsername = function(username, callback) {
    this.data.users[this.findAccountByUsername(username)]
      = this.data.users[this.total - 1];
    this.data.users[this.total - 1] = {"username": "", "password": ""};
    --(this.total);
    this.writeDataTo(usersdataFilename, function(err) {
      if (err) {
        if (chinese) console.log('', err.message, '\n保存失败\n');
        else console.log('', err.message, '\nFailed to store\n');
        if (callback) return callback();
      }
      if (callback) return callback();
    });
  }
  this.readDataFrom(filename, function(err) {
      // call UsersDataManager's callback
    if (callback) callback(err, self);
  });
}

function getAssignmentsId() {
  // if (globalAutomode) {
  //   fetched = true;
  //   //if (chinese) console.log('准备下载未完成的Assignment。');
  //   //else console.log('Ready to fetch unfinished assignments.');
  //   return fetchUnfinished(username, new Array(), fetchAsgn);
  // }
  prompt.start();
  if (chinese) {
    console.log("请输入 Assignment id");
    console.log('或者[敲下回车]下载未完成的 Assignment');
    console.log('  *** 注意：id应该是一个数字，像 588');
    console.log('  *** 允许一次输入多个id，像 586 587 588，用空格将id隔开');
    // console.log('  *** 您也可以输入一个 "u" 代表未完成的 Assignment，');
    // console.log('  *** 像 6910 u 2035  => 下载 6910、未完成的以及2035');
  } else {
    console.log("Please input the assignment id");
    console.log('or [simply press Enter] to fetch unfinished assignments');
    console.log('  *** Note: a valid assignment id is a number like 588');
    console.log('  *** multiple ids are allowed like 586 587 588, with ids separated by spaces');
    // console.log('  *** you may also input a "u" as an id to fetch unfinished assignments,');
    // console.log('  *** like 6910 u 2035  => 6910, unfinished ones and 2035 will be fetched');
  }
  prompt.get([{
    name: 'id',
    type: 'string',
    before: function(id) {return id.split(' ');}
  }], function(err, result) {
    if (err) throw err;
    var fetched = false;  // flag for unfinished assignments
    var rawId = result.id, countValidId = 0;
    var idArray = new Array();
      // simply press Enter => fetch unfinished assignments
    if (rawId.length == 1 && rawId[0] == '') {
      fetched = true;
      //if (chinese) console.log('准备下载未完成的 Assignment。');
      //else console.log('Ready to fetch unfinished assignments.');
      if (ByEncloseJS) return fetchUnfinished(username, idArray, fetchAsgn);
      else return fetchUnfinished(username);
    }
    for (i in rawId) {
      var oneId = rawId[i];
      if (!fetched && oneId.match(/^u$/)) {
          // id is u => fetch unfinished assignments
        fetched = true;
        //if (chinese) console.log('准备下载未完成的 Assignment。');
        //else console.log('Ready to fetch unfinished assignments.');
        if (ByEncloseJS) fetchUnfinished(username, idArray, fetchAsgn);
        else fetchUnfinished(username);
      } else if (oneId.match(/^(\d){1,5}$/)) {
          // id is valid => fetch the desired assignment
        ++countValidId;
        if (countValidId == 5) encloseJSWarning();
        //if (chinese) console.log('准备下载指定的 Assignment (id = ' + oneId + ')');
        //else console.log('Ready to fetch the desired assignment (id = ' + oneId + ')');
        //FetchOne(oneId, true, "", username);
        if (ByEncloseJS) idArray.push([oneId, true, "", username]);
        else FetchOne(oneId, true, "");
      } else if (oneId != '') {  // else => ignore
        if (chinese) console.log('忽略非法id "' + oneId + '"');
        else console.log('invalid id "' + oneId + '" ignored');
      }
    }
      // no valid id input
    if (countValidId == 0 && !fetched) {
      if (chinese) console.log('无效输入！请重试...');
      else console.log('Bad input! Please try again...');
      getAssignmentsId(username);
    } else if (ByEncloseJS) fetchAsgn(idArray);
  });
}


function loginMatrix(fromData, loginUsername, password) {
  if (chinese) console.log('正在登录....');
  else console.log("Logging in....");
  request.post({
    url: matrixRootUrl + '/signin',
    form: {
      'username': loginUsername,
      'password': password,
    }
  }, function(e, response, body) {
    if (e) return connectionFailed(e);
    body = JSON.parse(body);
    if (body.err) {
      var errorText = body.msg, incorrectCombi = false;  // incorrect username and password combination
      console.log('\nError:', errorText);
      if (chinese) console.log("登录失败，请重试 :(");
      else console.log("Login failed, please retry :(");
      if (~errorText.indexOf('Username is not found')
        || ~errorText.indexOf('Password is not match')) incorrectCombi = true;
      if (fromData && incorrectCombi) {
          // combination from usersDataManager is wrong => remove the wrong record
        return usersDataManager.removeAccountByUsername(loginUsername, function() {
            // and choose again
          return chooseAccount();
        });
      } else {
        return chooseAccount();  // directly choose again
      }
    }
    username = loginUsername, userId = body.data.id, savePath += '/' + username;
    if (chinese) console.log("用户", username, "登录成功");
    else console.log("Logged in with username", username);
    if (fromData) {
        // login with the combination from usersDataManager => get Id directly
      return getAssignmentsId();
    } else {
        // login with the user-input combination
        //   => allow user to store the new combination
      prompt.start();
      if (chinese) console.log('是否要在本地保存用户名和密码？');
      else console.log('Would you like to store the username and password locally?');
      prompt.get([{
        name: 'store',
        description: '[y/n]'
      }], function(err, result) {
        if (err) throw err;
        if (result.store == 'y' || result.store == 'Y' || result.store == 'yes'
            || result.store == 'Yes' || result.store == 'YES') {  // yes
          usersDataManager.addAccount(username, password);
          usersDataManager.writeDataTo(usersdataFilename, function(err) {
            if (err) {
              if (chinese) console.log('', err.message, '\n保存失败\n');
              else console.log('', err.message, '\nFailed to store\n');
              return getAssignmentsId();
            }
            if (chinese) console.log('... 保存成功\n');
            else console.log('... successfully stored\n');
            return getAssignmentsId();
          });
        } else {  // not to store
          if (chinese) console.log('未保存\n');
          else console.log('Not stored\n');
          return getAssignmentsId();
        }
      });
    }
  });
}

function getUsernameAndPassword(chosenUser) {
  prompt.start();
  if (chosenUser.password) {  // username and password from the chosen account
    loginMatrix(true, chosenUser.username, chosenUser.password);
  } else {
    prompt.get([{
      name: 'username',
      description: (chinese) ? '用户名' : 'username'
    }, {
      name: 'password',
      description: ((chinese) ? '密码' : 'password'),
      hidden: true,
      replace: '*',
      required: true
    }], function(err, result) {
      if (err) throw err;
        // username and password from user input
      return loginMatrix(false, result.username, getMD5(result.password));
    });
  }
}

function chooseAccount() {
  var total = usersDataManager.total;
  if (total == 0) {  // no users data stored locally => obtain username and password from user
    getUsernameAndPassword({'username': '', 'password': ''});
  } else {
    if (chinese) {
      console.log("请从下列的账号列表中，选择一个账号并输入其序号登录");
      console.log("或者[敲下回车]手动输入用户名和密码\n");
    } else {
      console.log("Please choose an account listed below to login by [inputting its index],");
      console.log("or [simply press Enter] so as to input username and password by yourself\n");
    }
    usersDataManager.listUsernames();
    prompt.start();
    prompt.get([{
      name: 'choice',
      description: (chinese) ? '序号' : 'choice',
      type: 'string',
    }], function(err, result) {
      if (err) throw err;
      if (result.choice == '') {
          // simply press Enter => obtain username and password from user
        return getUsernameAndPassword({'username': '', 'password': ''});
      } else if (1 <= parseInt(result.choice) && parseInt(result.choice) <= total) {
          // valid index => obtain username and password from the chosen account
        return getUsernameAndPassword(usersDataManager.getAccountByListedIndex(parseInt(result.choice)));
      } else {  // invalid index => choose again
        if (chinese) console.log("错误：检测到非法的序号。请重新输入一个正常的序号。");
        else console.log("Error: Invalid index detected. Please try again with a valid index.");
        return chooseAccount();
      }
    });
  }
}

function welcome() {
  if (chinese) console.log('欢迎！');
  else console.log("Welcome!");
    // allow the user to choose an account stored locally, if any
  chooseAccount();
}

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

request.get(matrixRootUrl, function(err, response, body) {
  if (err) {
    connectionFailed(err);
    throw err;
  }
  jQexec(body, function(err, window) {
    var $ = window.$;
    // informServerError($);
    // var csrf = $($('[name=csrfmiddlewaretoken]')[0]).val();
    new UsersDataManager(usersdataFilename, function(err, self) {
      if (err) return;
      else return usersDataManager = self, welcome();
    });
  });
});
