var windows = true;
var mac = false;
var ubuntu = false;
var chinese = true;

var sanitize = require('sanitize-filename');
var request = require('request');
var mkdirp = require('mkdirp');
var prompt = require('prompt');
var path = require('path');
var getDirName = path.dirname;
var fs = require('fs');
var crypto = require('crypto');
var sprintf = require('sprintf-js').sprintf;
var diff = require('diff');

var matrixRootUrl = 'https://eden.sysu.edu.cn:8000';
var usersdataFilename = '.usersdata';
var outputExt = '.txt';
var username = '', userId = '', usersDataManager = null, savePath = './saved';

var cancelMemoryCheck = false;
var recursiveCall = 50;

var modes = {'submitCodes': 1, 'specificOutput': 2, 'latestOutput': 3,
'downloadProblem': 4, 'downloadSubmittedCodes': 5};

function getMD5(data) { return crypto.createHash('md5').update(data).digest('hex'); }

function readDataFrom(filenameInfo, filename, callback) {
  fs.stat(filenameInfo.dir + '/' + filenameInfo.base, function(err, stat) {
    if (err) {
      if (callback) console.log('', err.message), callback(err, filenameInfo);
      else throw err;
    } else {
      fs.readFile(filenameInfo.dir + '/' + filenameInfo.base, 'utf-8', function(err, rawData) {
        if (err) {
          if (callback) console.log('', err.message), callback(err);
          else throw err;
        } else if (callback) callback(null, filenameInfo, filename, rawData.replace(/\r\n/g, '\n'));
      });
    }
  });
};

function writeFile(path, contents, callback) {
  mkdirp(getDirName(path), function(err) {
    if (err) {
      console.log('\nError:', err.message);
      if (callback) return callback(err);
      else throw err;
    }
    if (windows) contents = contents.replace(/\n/g, '\r\n');
    fs.writeFile(path, contents, function(err) {
      if (err) {
        console.log('\nError:', err.message);
        if (callback) return callback(err);
        else throw err;
      }
      else if (callback) return callback(null);
    });
  });
}

function createFile(overwrite, path, contents, callback) {
  if (overwrite) return writeFile(path, contents, callback);
  fs.stat(path, function(err, stat) {
    if (err) {
      if (err.code == 'ENOENT') return writeFile(path, contents, callback);
      else {
        console.log('\nError:', err.code, err.message);
        if (callback) return callback(err);
        else throw err;
      }
    } else {
      return callback(null);
    }
  });
}

function informConnectionFailed(err, problemId) {
  var hint = '', insertProblemId = ((problemId) ? ((chinese) ? 'Problem ' + problemId + ' 不存在，' : ' , nonexistence of the Problem ' + problemId) : '');
  if (chinese) hint = '  *** 这可能是因为您的电脑没有连网，' + insertProblemId + '或者 TA 叶嘉祺正在更新代码。';
  else hint = '  *** Lack of access to internet' + insertProblemId + ' or TA Ye Jiaqi being updating codes may cause this error. ';
  if (!problemId) console.log('');
  if (chinese) {
    if (!problemId) console.log('连接错误: 无法连接到 Matrix，请稍后再试:(');
    console.log(hint);
  } else {
    if (!problemId) console.log('ConnectionError: Failed to connect to Matrix, please try again later:(');
    console.log(hint);
  }
  if (err) throw err;
}

function submitAtString(str) {
  var date = new Date();
  if (~str.indexOf('.000Z')) {
    date.setUTCFullYear(str.substring(0, 4)), date.setUTCMonth(parseInt(str.substring(5, 7)) - 1), date.setUTCDate(str.substring(8, 10)), date.setUTCHours(str.substring(11, 13)), date.setUTCMinutes(str.substring(14, 16)), date.setUTCSeconds(str.substring(17, 19));
    return date.getFullYear() + '/' + (parseInt(date.getMonth()) + 1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
  } else {
    date.setFullYear(str.substring(0, 4)), date.setMonth(parseInt(str.substring(5, 7)) - 1), date.setDate(str.substring(8, 10)), date.setHours(str.substring(11, 13)), date.setMinutes(str.substring(14, 16)), date.setSeconds(str.substring(17, 19));
    return date.getUTCFullYear() + '-' + (parseInt(date.getUTCMonth()) + 1) + '-' + date.getUTCDate() + 'T' + date.getUTCHours() + ':' + date.getUTCMinutes() + ':' + date.getUTCSeconds() + '.000Z';
  }
}

function toSubmitAt(str, toReadable) {
  var date = new Date();
  var prefixZero = function(str) {
    return (String(str).length - 1) ? String(str) : '0' + str;
  }
  var to000Z = function() {
    date.setFullYear(str.substring(0, 4)), date.setMonth(parseInt(str.substring(5, 7)) - 1), date.setDate(str.substring(8, 10)), date.setHours(str.substring(11, 13)), date.setMinutes(str.substring(14, 16)), date.setSeconds(str.substring(17, 19));
    return date.getUTCFullYear() + '-' + prefixZero(parseInt(date.getUTCMonth()) + 1) + '-' + prefixZero(date.getUTCDate()) + 'T' + prefixZero(date.getUTCHours()) + ':' + prefixZero(date.getUTCMinutes()) + ':' + prefixZero(date.getUTCSeconds()) + '.000Z';
  };
  var toNormal = function() {
    date.setUTCFullYear(str.substring(0, 4)), date.setUTCMonth(parseInt(str.substring(5, 7)) - 1), date.setUTCDate(str.substring(8, 10)), date.setUTCHours(str.substring(11, 13)), date.setUTCMinutes(str.substring(14, 16)), date.setUTCSeconds(str.substring(17, 19));
    return date.getFullYear() + '-' + prefixZero(parseInt(date.getMonth()) + 1) + '-' + prefixZero(date.getDate()) + ' ' + prefixZero(date.getHours()) + ':' + prefixZero(date.getMinutes()) + ':' + prefixZero(date.getSeconds());
  }
  if (~str.indexOf('.000Z')) {
      if (toReadable || toReadable === undefined) return toNormal();
      else return str;
  } else {
      if (toReadable) return str;
      else return to000Z();
  }
  // if (toReadable === undefined) {
  //   if (~str.indexOf('.000Z')) {
  //     return toNormal();
  //   } else {
  //     return to000Z();
  //   }
  // } else if (toReadable) {
  //   if (~str.indexOf('.000Z')) {
  //     return toNormal();
  //   } else {
  //     return str;
  //   }
  // } else {
  //   if (~str.indexOf('.000Z')) {
  //     return str;
  //   } else {
  //     return to000Z();  
  //   }
  // }
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
      if (callback) return console.log('', err.code, err.message, '\n  ... Error occurred when downloading ' + dest), callback(err);
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
      if (callback) return console.log('', err.code, err.message, '\n  ... Error occurred when downloading ' + dest), callback(err);
    });
    sendReq.pipe(file);
    file.on('finish', function() {
      file.close(callback);  // call callback after close completes.
    });
    file.on('error', function(err) {  // Handle errors
      fs.unlink(dest); // Delete the file async.
      if (callback) return console.log('', err.code, err.message, '\n  ... Error occurred when downloading ' + dest), callback(err);
    });
  });
};

function informParseErr(parseErr, phase) {
  console.log('\nError:', parseErr.message);
  if (chinese) console.log('解析错误：服务器返回的数据不完整，无法正确解析', ('(' + ((phase) ? phase : '') + ' phasing error)'));
  else console.log('Parsing Error: fail to parse data due to data loss', ('(' + ((phase) ? phase : '') + ' phasing error)'));
}

function informBodyErr(bodyErr) {
  console.log('\nError:', bodyErr.message);
  if (chinese) console.log('内部错误：未能获取批改结果。');
  else console.log('Internal Error: fail to fetch the grading report.');
}


function fetchSubmissionOutput(problemId, submissionId, submitAt, foldername, getAc, overwrite, getGrading, callback) {
  

  // get submission time
  // request.get(matrixRootUrl + '/get-one-assignment-info?position=0&problemId=' + problemId + '&status=2&userId=' + userId, function(e, r, body) {
  
  /* for debug */
  // request.get(matrixRootUrl + '/get-one-assignment-info?position=0&problemId=' + '3' + '&status=2&userId=' + userId, function(e, r, body) {
  /* end */

    /** prefix one-digit number with a 0
      * @param date <string> "XXXX/YY/Y Y:YY:Y" representing submit time
      * @return <string> "XXXX-YY-0Y 0Y:YY:0Y" for linux
      *               or "XXXX-YY-0Y 0Y-YY-0Y" for win
      * 
      * private but independent
      */
    var prefixWithZero = function(date) {
      date = date.replace(/(\/)(?=(\d)(\D))/g, '-0').replace(/( )(?=(\d)(\D))/g, ' 0').replace(/((\:)(?=(\d)(\D)))|((\:)(?=(\d)$))/g, ':0').replace(/(\/)/g, '-');
      if (windows) return date.replace(/\:/g, '-');
      else return date;
    };

    /** if we fail to get submission time
      *   => use local time instead
      */
    // var parseErr = null;
    // try {
    //   body = JSON.parse(body);
    // } catch (e) {
    //   parseErr = e;
    // }
    // if (e || parseErr || body.err || !body.data.length) {
    //   var date = new Date();
    //   suffixTime = prefixWithZero('downloaded at ' + date.getFullYear() + '/' + (parseInt(date.getMonth()) + 1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds());
    // } else {
    //   var latest = body.data[0];
    

    // get report json
    var afterGetSubmission = function(e, response, body) {
      
    /* for debug */
    // request.get('https://eden.sysu.edu.cn/get-submission-by-id?submissionId=' + 3862, function(e, r, body) {  
    /* end */

      /** if connection failed
        *  => skip current problemId
        */
      var filename = problemId + ' Output ' + ((getAc) ? '(including CR) ' : '') + suffixTime + outputExt;
      if (e) {
        console.log('\nError:', e.message, 'problemId = ', problemId);
        if (callback) return callback(e, filename);
        else throw e;
      }


      /** if parsing fails
        *   => skip current problemId
        */
      var parseErr = null;
      try {
        body = JSON.parse(body);
      } catch (e) {
        parseErr = e;
      }
      if (parseErr || (body && body.err)) {
        var bodyErr = (body && body.err) ? new Error(body.msg) : null;
        var err = (parseErr) ? parseErr : bodyErr;
        if (parseErr) informParseErr(err, 'report body');
        else if (bodyErr) informBodyErr(err);
        if (callback) return callback(err, filename);
        else throw err;
      }
      

      parseErr = null;

      /** data: {grade, report}
        * content: the final result to be written into file
        */
      var data = null, content = '';
      if (submissionId) data = body.data;
      else data = body.data[0]; 

      /* for debug */
      // var data = body.data, content = '';
      /* end */

      var existenceError = new Error('No useful output detected.\n  *** You might want to check out the Problem (id = ' + problemId + ') by yourself.');

      /** if data is empty
        *   => impossible to get any information
        *   => skip current problemId
        */
      if (!data) {
        console.log('\nError:', existenceError.message);
        if (callback) return callback(existenceError, filename);
        else return;
      }

      /** grade: total scores
        * report: consists of the five phases
        */
      var grade = data.grade, report = null;

      if (getGrading && (!~grade || grade === null)) {
        --recursiveCall;
        if (recursiveCall) {
          return setTimeout(function() {
              fetchSubmissionOutput(problemId, submissionId, submitAt, foldername, getAc, overwrite, true, callback);
            }, 5000);
        } else {
          console.log('\nError:', existenceError.message);
          if (callback) return callback(existenceError, filename);
          else return;
        }
      }

      /** if parsing fails
        *   => attempt to complete it
        *     if it fails again
        *       => impossible to get any info from it
        *       => skip current problemId
        */
      try {
        report = JSON.parse(data.report);

      } catch (e) {
        try {
          report = JSON.parse(data.report + ' more data..."}]}}');
        } catch (e) {
          parseErr = e;
        }
      }
      if (parseErr) {
        informParseErr(parseErr, 'report content');
        if (callback) return callback(parseErr, filename);
        else throw parseErr;
      }

      parseErr = null;

      /** if report is empty (typically null)
        *   => impossible to get any information
        *   => skip current problemId
        * 
        * else if report contains error
        *   => write it into file
        */
      if (!report) {
        console.log('\nError:', existenceError.message);
        if (callback) return callback(existenceError, filename);
        else return;
      } else if (report.error) {
        content += '\nError: ' + report.error + '\n';
      }

      content += '\nYour Grade: ' + grade + '\n';
      var noNewLine = '(No \\n at the end)';
      
      /** @param str <string/undefined> the string to be wrapped
        * @param append <string/undefined> append itself, if defined, after str
        * @return <string>
        * 
        * private but independent
        */
      var wrap = function(str, append) {
        return ((typeof(str) != 'undefined') ? (str + ((typeof(append) != 'undefined') ? append : '')) : '(missing)\n');
      };
      
      /** @param str <string> the string to be wrapped with borders
        * @param borderSpaceNum <number> the number of spaces before borders
        * @return <string>
        * 
        * private but independent
        */
      var wrapBorder = function(str, borderSpaceNum) {
        var border = ' '.repeat(borderSpaceNum) + '+-----------------------------------\n';
        return border + str + border;
      };

      /** @param str <string> the stdin to be wrapped
        * @return <string> 
        * 
        * private, dependent on noNewLine
        */
      var wrapStdin = function(str) {
        if (str.length == 0) return "(No input)\n";
        else if (str[str.length - 2] != '\n' && str != '(missing)\n') return str += (noNewLine + '\n');
        else return str;
      };


      /** @param tests <[{standard_output, stdin, stdout, ...}]> array of tests
        * @param std <boolean> true => standard test
        *                     false => random tests
        * @return <undefined>
        * 
        * private, dependent on ..
        */
      var polishTests = function(tests, std) {
        var prefixTitle = (std) ? 'Standard' : 'Random';

        /** @param ac <boolean> true => to get CR samples
          * @return <undefined>
          * 
          * private, dependent on ..
          */
        var polish = function(ac) {
          // number of nonpass tests
          var wrongNum = 0;
          for (i in tests) {
            /* for debug */
            // tests[0] = JSON.parse('{"memoryused":6044,"result":"WA","standard_stdout":"2000/06/10-23:30:32 : smyfeobsiwcyjd\\n2006/05/18-23:44:38 : iqfmacdidhxavuttvunaewlngzkzrcswyslobffp\\n2010/05/01-17:00:03 : goyzcfacjvybbusdxttzbqrzbz\\n2018/09/13-05:42:02 : newxqoeeeigqm\\n2018/10/08-16:55:36 : erffudcvxsyfkbnvyc\\n2021/06/19-01:35:17 : ccymckbipr\\n2023/10/10-02:32:23 : lvfxerxksckmsbctyjmzjovkdhoqlkqngvkzg\\n2027/06/18-21:35:34 : glhrly\\n2027/12/28-23:54:00 : glahyskqprdjjvjxuvzvsxmm\\n2034/07/04-02:12:06 : tyvuzubhw\\n2036/01/2sad5-15:02:08 : tytttpzyplzwfxwhjeqfrbfwrseepsjbkyyuce\\n2045/07/21-23:31:31 : dvqdrozllatdkqft\\n2052/08/06-22:34:29 : kahsmvbhjrqtsivcy\\n2062/11/02-04:46:55 : ozrpkoochkgkawkggrcdf\\n2064/12/12-07:18:31 : lmisrmmswjmoovnoqisqinknuyo\\n2070/04/24-21:04:15 : mfkenostccdfapsqjlksny\\n2082/03/10-02:25:07 : hyci\\n2094/03/18-11:16:31 : bimfyz\\n2096/08/08-13:27:30 : hmvthlqlgbwrusxdbusju\\n","stdin":"19\\n2027/06/18-21:35:34|glhrly\\n2023/10/10-02:32:23|lvfxerxksckmsbctyjmzjovkdhoqlkqngvkzg\\n2094/03/18-11:16:31|bimfyz\\n2010/05/01-17:00:03|goyzcfacjvybbusdxttzbqrzbz\\n2018/09/13-05:42:02|newxqoeeeigqm\\n2070/04/24-21:04:15|mfkenostccdfapsqjlksny\\n2062/11/02-04:46:55|ozrpkoochkgkawkggrcdf\\n2096/08/08-13:27:30|hmvthlqlgbwrusxdbusju\\n2045/07/21-23:31:31|dvqdrozllatdkqft\\n2006/05/18-23:44:38|iqfmacdidhxavuttvunaewlngzkzrcswyslobffp\\n2034/07/04-02:12:06|tyvuzubhw\\n2064/12/12-07:18:31|lmisrmmswjmoovnoqisqinknuyo\\n2018/10/08-16:55:36|erffudcvxsyfkbnvyc\\n2000/06/10-23:30:32|smyfeobsiwcyjd\\n2052/08/06-22:34:29|kahsmvbhjrqtsivcy\\n2021/06/19-01:35:17|ccymckbipr\\n2036/01/25-15:02:08|tytttpzyplzwfxwhjeqfrbfwrseepsjbkyyuce\\n2027/12/sda28-23:54:00|glahyskqprdjjvjxuvzvsxmm\\n2082/03/10-02:25:07|hyci\\n","stdout":"2000/06/10-23:30:32 : smyfeobsiwcyjd\\n2006/05/18-23:44:38 : iqfmacdidhxavuttvunaewlngzkzrcswyslobffp\\n2010/05/01-17:00:03 : goyzcfacjvybbusdxttzbqrzbz\\n2018/09/13-05:42:02 : newxqoeeeigqm\\n2018/10/08-16:55:36 : erffudcvxsyfkbnvyc\\n2021/06/19-01:35:17 : ccymckbipr\\n2023/10/10-02:32:23 : lvfxerxksckmsbctyjmzjovkdhoqlkqsngvkzg\\n2027da/06/18-21:35:34 : glhrly\\n2027/12/28-23:54:00 : glahyskqprdjsdadjvjxuvzvsxmm\\n2034/07/04-02:12:06 : tyvuzubhw\\n2036/01/25-15:02:08 : tytttpzyplzwfxwhjeqfrbfwrseepsjbkyyuce\\n2045/07/21-23:31:31 : dvqdrozllatdkqft\\n20dsad52/08/06-22:34:29 : kahsmvbhjrqtsivcy\\n2062/11/02-04:46:55 : ozrpkoochkgkawkggrcdf\\n2064/12/12-07:18:31 : lmisrmmswjmoovnoqisqinknuyo\\n2070/04/24-21:04:15 : mfkenostccdfapsqjlksny\\n2082/03/10-02:25:07 : hyci\\n2094/03/18-11:16:31 : bimfyz\\n2096/08/08-13:27:30 : hmvthlqlgbwrusxdbusju","timeused":0}');
            /* end */

            // contents to be compared
            var stdContent = null, yourContent = null;

            /** @param str <string> string of lines to be prefixed with line numbers
              * @param your <bool/undefined> true => your output
              *                              false => standard output
              * @return <string> result
              * 
              * private, dependent on ..
              */
            var addLinenum = function(str, your) {
              // a mark prefixed before lines
              var prefix = ((your == true) ? 'Your ' : ((your == false) ? ' Std ' : ''));

              // special cases
              if (str == '(missing)\n') return '*********|(Missing)\n';
              else if (str.length == 0) return "*********|(No output)\n";

              /** length: the length of str
                * ret: text with lines added line numbers
                * backup: for stdContent and yourContent
                * oneLine: the line of the main content
                */
              var length = str.length, ret = '', backup = '', oneLine = '';
              var endWithNewLine = false, moreData = false;
              
              // set flags
              if (str.match(/ more data\.\.\.$/)) str = str.slice(0, -14), moreData = true;
              else if (str.match(/ more data$/)) str = str.slice(0, -10), moreData = true;
              if (!moreData && str[length - 1] == '\n') endWithNewLine = true;
              
              str = str.split('\n');
              for (i in str) {

                /** if the line ends with a space
                  *   => append a hint after the line
                  */
                var endWithSpace = false, endSpace = '(<- has a space at the end)';
                if (str[i][str[i].length - 1] == ' ') endWithSpace = true;

                oneLine = str[i] + (endWithSpace ? endSpace : '') + '\n';

                ret += (sprintf(prefix + '%03d |', parseInt(i) + 1) + oneLine), backup += oneLine;
              }


              if (!endWithNewLine) {
                ret += prefix + '    |';
                if (moreData) oneLine = ' more data...\n', ret += oneLine, backup += oneLine;
                else oneLine = noNewLine + '\n', ret += oneLine, backup += oneLine;
              } else if (moreData) oneLine = ' more data...\n', ret += oneLine, backup += oneLine;
              if (typeof(your) == 'boolean') {
                if (your) yourContent = backup;
                else stdContent = backup;
              }
              return ret;
            };
            var difference = function() {
              var ret = '';
              var result = diff.diffLines(stdContent, yourContent), linenum = 0;
              for (i in result) {
                var part = result[i], value = part.value.slice(0, -1).split('\n'), resultLength = result.length;
                if (!part.added && !part.removed) {
                  if (i != 0) ret += '\n';
                  for (j in value) ret += sprintf('  Yr %03d |', ++linenum) + value[j] + '\n';
                  if (i != resultLength - 1) ret += '\n';
                } else {
                  var formerIsCommonData = (!result[parseInt(i) - 1] || (!result[parseInt(i) - 1].added && !result[parseInt(i) - 1].removed));
                  var latterIsCommonData = (!result[parseInt(i) + 1] || (!result[parseInt(i) + 1].added && !result[parseInt(i) + 1].removed));
                  if (formerIsCommonData && latterIsCommonData) {
                    for (j in value) ret += ((part.added) ? (++linenum, 'Your add |') : ' Std add |') + value[parseInt(j)] + '\n';
                  } else {
                    for (j in value) ret += ((part.added) ? (++linenum, 'Your has |') : ' Std has |') + value[j] + '\n';
                  }
                }
              }
              return ret;
            }
            var test = tests[i], resultCode = test.result;
            if (!ac && (test.error || (test.message && test.message != 'Program finished running.'))) {
              var msg = (test.error) ? test.error : test.message;
              content += '\n============ ' + prefixTitle + ' Test #' + (parseInt(i) + 1) + ' ===============\n';
              content += 'Error: ' + msg + '\n';
              if (test.stdin) content += '\n Test input:\n' + wrapBorder(wrapStdin(wrap(test.stdin, '\n'), 0)) + '\n';
              ++wrongNum;
              continue;
            }
            if (ac) {
              if (resultCode != 'CR') continue;
            } else {
              if (resultCode == 'CR') continue;
              else ++wrongNum;
            }
            var memory = test.memoryused, time = test.timeused;
            var stdin = test.stdin, standard_stdout = test.standard_stdout, stdout = test.stdout;
            
            content += '\n============ ' + prefixTitle + ' Test #' + (parseInt(i) + 1) + ' ===============\n';
            content += 'Result code: ' + wrap(resultCode) + '\n';
            content += 'Memory used: ' + wrap(memory, 'KB') + '  Time used: ' + wrap(time, 'ms') + '\n\n';
            content += ' Test input:\n' + wrapBorder(wrapStdin(wrap(stdin, '\n'), 0)) + '\n';
            if (ac) {
              content += '     Answer:\n' + wrapBorder(addLinenum(wrap(stdout)), 4) + '\n';
            } else {
              content += '          Standard answer:\n' + wrapBorder(addLinenum(wrap(standard_stdout), false), 9) + '\n';
              content += '          Your answer:\n' + wrapBorder(addLinenum(wrap(stdout), true), 9) + '\n';
              if (!stdContent || !yourContent) continue;
              var diffResult = difference();
              if (diffResult) content += '          Difference:\n' + wrapBorder(diffResult, 9);
            }
          }
          if (!ac && !wrongNum) content += 'pass\n';
        };
        // if (tests[0] && tests[0].message == "Malicious code detected! This unusual behavior will be recorded  by the system") {
        //   content += '\nError: ' + tests[0].message + '\n';
        //   return;
        // }
        polish(false);
        if (getAc) polish(true);
      };
      var toContinue = true;
      var polishCompileMsg = function(info) { content += info + '\n'; };
      var polishStaticCheckMsg = function(info) {
        if (info == "static parse error") {
          content += '\nError: ' + info + '\n';
          return;
        }
        var violation = info.violation;
        if (violation.length == 0) content += 'pass\n';
        for (i in violation) {
          var oneViolation = violation[i];
          var range = function(begin, end) {
            if (begin == end) return begin;
            else return begin + ' ~ ' + end;
          };
          content += '\n============ Violation #' + (parseInt(i) + 1) + ' ===============\n';
          content += '  File: ' + oneViolation.path.substr(5) + '\n';
          content += '  Line: ' + range(oneViolation.startLine, oneViolation.endLine) + '\n';
          content += 'Column: ' + oneViolation.startColumn + ' ~ ' + oneViolation.endColumn + '\n';
          content += '  Rule: ' + oneViolation.rule + '\n';
          content += (oneViolation.message) ? 'Detail: ' + oneViolation.message + '\n' : '';
          content += '\n';
        }
      };
      var polishStandardTests = function(info) { polishTests(info, true); };
      var polishRandomTests = function(info) { polishTests(info, false); };
      var hasMemory = false;
      var polishMemoryTests = function(info) {
        var pass = true;

        for (i in info) {
          var test = info[i], stdin = test.stdin;
          hasMemory = true;
          if (test.error || test.message) {
            var msg = (test.error) ? test.error : test.message;
            content += '\n============ Memory Test #' + (parseInt(i) + 1) + ' ===============\n';
            content += 'Error: ' + msg + '\n';
            if (test.stdin) content += '\n Test input:\n' + wrapBorder(wrapStdin(wrap(test.stdin, '\n'), 0)) + '\n';
            pass = false;
            continue;
          }
          var errors = test.valgrindoutput.error;
          // if (typeof(errors) == 'undefined') continue;
          // errors = errors.error;
          if (!errors) continue;
          else pass = false;

          content += '\n=================== Memory Test #' + (parseInt(i) + 1) + ' =====================\n';
          content += '\n Test input:\n' + wrapBorder(wrapStdin(wrap(stdin, '\n'), 0)) + '\n';
          if (typeof(errors.length) == 'undefined') errors = new Array(errors);
          for (j in errors) {
            var oneError = errors[j], behavior = oneError.what;

            content += '------------- Error #' + (parseInt(j) + 1) + ' -----------\n';

            var auxwhat = oneError.auxwhat, stack = oneError.stack;
            
            if (!behavior) {
              if (oneError.kind == 'Leak_DefinitelyLost') {
                behavior = 'Memory leak';
                auxwhat = oneError.xwhat.text;
              } else if (oneError.kind == 'Leak_PossiblyLost') {
                behavior = 'Possible memory leak';
                auxwhat = oneError.xwhat.text;
              } else {
                content += 'Behavior: ' + wrap(behavior) + '\n';
                content += '\n' + oneError + '\n';
                continue;
              }
            }

            if (typeof(auxwhat) == 'string') auxwhat = new Array(auxwhat);
            content += 'Behavior: ' + wrap(behavior) + '\n';
            if (typeof(stack.length) == 'undefined') stack = new Array(stack);


            // if ( ~behavior.indexOf('ismatch')
            //   || ~behavior.indexOf('Invalid read of size')
            //   || ~behavior.indexOf('Invalid write of size')
            //   || ~behavior.indexOf('leak')
            //   || ~behavior.indexOf('Use of uninitialised value of size')
            //   || behavior == 'Invalid free() / delete / delete[] / realloc()'
            //   || behavior == 'Conditional jump or move depends on uninitialised value(s)') {
            for (k in stack) {
              var frame = stack[k].frame;
              if (typeof(frame.length) == 'undefined') frame = new Array(frame);
              if (k == 0) content += '  ';
              else content += ' ' + auxwhat[k - 1] + ':\n  ';
              for (l in frame) {
                var funcInfo = frame[l];
                if (l != 0) content += 'by:';
                else content += 'at:';
                // if (funcInfo.file && funcInfo.line) content += ' ' + funcInfo.file + ' Line ' + funcInfo.line + '\n  ';
                // content += '  ' + funcInfo.fn + '\n  ';
                if (funcInfo.file && funcInfo.line) content += ' ' + funcInfo.file + ' Line ' + funcInfo.line + '\n  ' + '  ' + funcInfo.fn + '\n  ';
                else content += ' ' + (funcInfo.fn ? funcInfo.fn : 'some func') + ' precompiled in ' + funcInfo.obj + '\n  ';
              }
              content += '\n';
            }
            content += '\n';
          }
          
        }
        if (pass) content += 'pass\n', hasMemory = false;
      };
      var polishPhase = function(phase, func) {
        if (toContinue && report[phase] && report[phase][phase]) {
          toContinue = report[phase]['continue'];
          content += '\n>>>>>>>>>>>>>>>>>> [' + phase + '] <<<<<<<<<<<<<<<<<<<<<<<\nGrade: ' + report[phase]['grade'] + '\n';
          if (phase == 'memory check' && cancelMemoryCheck) return content += 'Canceled.\n';
          return func(report[phase][phase]);
        } else {
          return;
        }
      };
      var phases = [{'name': 'compile check',
                     'func': polishCompileMsg},
                    {'name': 'static check',
                    'func': polishStaticCheckMsg},
                    {'name': 'standard tests',
                    'func': polishStandardTests},
                    {'name': 'random tests',
                    'func': polishRandomTests},
                    {'name': 'memory check',
                    'func': polishMemoryTests}];

      for (i in phases) polishPhase(phases[i].name, phases[i].func);

                // false: not to overwrite
      // if (hasMemory)
      
      createFile(overwrite, savePath + '/' + foldername + '/' + 'Submission Outputs/' + filename, content, function(err) {
        if (callback) return callback(err, filename);
        else return;
      });
    };
  // });
  var suffixTime = '';
  if (submissionId) {
    suffixTime = prefixWithZero('at ' + toSubmitAt(submitAt, true));
    return request.get(matrixRootUrl + '/one-submission?submissionId=' + submissionId, afterGetSubmission);
  } else {
    var date = new Date();
    suffixTime = prefixWithZero('downloaded at ' + date.getFullYear() + '/' + (parseInt(date.getMonth()) + 1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds());
    return request.get(matrixRootUrl + '/last-submission-report?problemId=' + problemId + '&userId=' + userId, afterGetSubmission);
  }
}


// function downloadStandardAnswerBinaries(Id, savePath, callback) {
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
// }

function FetchOne(problemId, tobeDone, getAc, overwrite, mode, callback) {

  request.get(matrixRootUrl + '/one-problem?problemId=' + problemId, function(e, r, body) {
    if (e) {
      console.log('\nError:', e.code, e.message);
      informConnectionFailed(null, problemId);
      informFetchResult(e, problemId);
      if (callback) return callback(e);
      else return;
    }
    var parseErr = null;
    try {
      body = JSON.parse(body);
    } catch (e) {
      parseErr = e;
    }
    if (parseErr || (body && body.err)) {
      var bodyErr = (body && body.err) ? new Error(body.msg) : null;
      var err = (parseErr) ? parseErr : bodyErr;
      if (parseErr) informParseErr(err, 'problem info');
      else if (bodyErr) informBodyErr(err);
      return informFetchResult(err, problemId);
    }
    parseErr = null;
    var data = body.data, config = JSON.parse(data.config);
    var supportFiles = data.supportFiles, codeFilenames = config.code_files.answer;
    var title = data.title, c11 = false;
    if (config.compilers['c++']) c11 = Boolean(~config.compilers['c++'].command.indexOf('-std=c++11'));
    var author = data.author, memoryLimit = config.limits.memory + 'MB', timeLimit = config.limits.time + 'ms';
    var error = null;

    var fetch = function(submissionId, submitAt, getac, over, getGrading) {
      fetchSubmissionOutput(problemId, submissionId, submitAt, problemId + ' ' + title, getac, over, getGrading, function(err, filename) {
        var error = null;
        if (err) error = err;
        informFetchOutputResult(error, filename);
        if (callback) return callback();
      });
    };
    if (mode == modes.submitCodes) {
      var filesToSubmit = {'fileNum': 0};
      getCodeFilesFromUser(codeFilenames, filesToSubmit, codeFilenames.length, function(err, filesToSubmit) {
        if (err) {
          if (chinese) console.log('读取代码文件时出错。请重试');
          else console.log('Errors occurred when it was reading code files. Please try again.');
          filesToSubmit = {'fileNum': 0};
          return getCodeFilesFromUser(codeFilenames, filesToSubmit, codeFilenames.length, arguments.callee);
        } else {
          // getSubmissionTimeFromUser(function(err, submitDate) {
            var submitDate = null;
            var date = submitDate;
            var submitAt = '';
            var prefixWithZero = function(date) {
              return date.replace(/(-)(?=(\d)(\D))/g, '-0').replace(/(T)(?=(\d)(\D))/g, 'T0').replace(/((\:)(?=(\d)(\D)))|((\:)(?=(\d)$))/g, ':0');
            };

            if (submitDate == null) date = new Date();
            submitAt = prefixWithZero(date.getUTCFullYear() + '-' + (parseInt(date.getUTCMonth()) + 1) + '-' + date.getUTCDate() + 'T' + date.getUTCHours() + ':' + date.getUTCMinutes() + ':' + date.getUTCSeconds() + '.000Z');

            submitAnswer(problemId, undefined, filesToSubmit, function(err, submissionId) {
              if (err) {
                if (chinese) console.log('提交失败');
                else console.log('Failed to submit');
                if (callback) return callback();
                else return;
              } else {
                recursiveCall = 50;
                if (chinese) console.log('提交成功。正在获取', submitAtString(submitAt), '时提交的结果');
                else console.log('Submitted successfully. Getting submission output at', date.toLocaleString());
                fetch(submissionId, submitAt, getAc, overwrite, true);
              }
            });
          // });
        }
      });
    } else if (mode == modes.specificOutput) {
      getListOfSubmissions(problemId, 0, [], function(err, info) {
        var submissionId = undefined, submitAt = undefined;
        if (err) {
          console.log('Failed to get submission list. Downloading the latest submission for you');
          fetch(submissionId, submitAt, getAc, overwrite, false);
        } else if (info.length == 0) {
          console.log('impossible to fetch any codes');
        } else {
          getSubmissionsIdFromUser(info.length, getAc, overwrite, function(err, id, getac, over) {
            if (err) {
              console.log('Failed to get submission id');
              if (callback) return callback();
              else throw err;
            } else {
              submissionId = info[id - 1].id, submitAt = info[id - 1].submitAt;
            
              fetch(submissionId, submitAt, getac, over, false);
            }

            
          });
        }
        
      });
    } else if (mode == modes.latestOutput) {
      fetch(undefined, undefined, getAc, overwrite, false);
    } else if (mode == modes.downloadProblem) {
      createFile(true, savePath + '/' + problemId + ' ' + title + '/Description.md', data.content, function(e) {
        
      });
      for (i in supportFiles) {
        createFile(true, savePath + '/' + problemId + ' ' + title + '/' + i, supportFiles[i], function(e) {
        
        });
      }
      for (i in codeFilenames) {
        createFile(false, savePath + '/' + problemId + ' ' + title + '/' + codeFilenames[i], '', function(e) {
        
        });
      }
    } else if (mode == modes.downloadSubmittedCodes) {
      getListOfSubmissions(problemId, 0, [], function(err, info) {
        var submissionId = undefined, submitAt = undefined;
        if (err) {
          console.log('Failed to get submission list.');
        } else if (info.length == 0) {
          console.log('impossible to fetch any codes');
        } else {
          getSubmissionsIdFromUser(info.length, getAc, overwrite, function(err, id, getac, over) {
            if (err) {
              console.log('Failed to get submission id');
              if (callback) return callback();
              else throw err;
            } else {
              submissionId = info[id - 1].id, submitAt = info[id - 1].submitAt;
              // for (i in supportFiles) {
              //   createFile(true, savePath + '/' + problemId + ' ' + title + '/Submitted Codes/' + toSubmitAt(submitAt) + '/' + i, supportFiles[i], function(e) {
                
              //   });
              // }
              var submitTime = toSubmitAt(submitAt, true);
              if (windows) submitTime = submitTime.replace(/:/g, '-');
              getSubmittedCodes(submissionId, function(err, submittedCodeFiles) {
                for (i in submittedCodeFiles) {
                  createFile(false, savePath + '/' + problemId + ' ' + title + '/Submitted Codes/' + submitTime + '/' + i, submittedCodeFiles[i], function(e) {
                  
                  });
                }
              });
            }
          });
        }
        
      });
    }
    
  });
}

function informFetchResult(error, Id) {
  if (chinese) {
    if (error) console.log('  ... 下载 Problem ' + Id + ' 时出错。');
    else console.log('  ... 成功下载 Problem ' + Id + '!');
  } else {
    if (error) console.log('  ... There occurred some errors when Problem ' + Id + ' are being downloaded.');
    else console.log('  ... Problem ' + Id + ' downloaded successfully!');
  }
}

function informFetchOutputResult(error, filename) {
  if (chinese) {
    if (error) console.log('  ... 下载 ' + filename + ' 时出错。');
    else console.log('  ... 成功下载 ' + filename + '!');
  } else {
    if (error) console.log('  ... There occurred some errors when ' + filename + ' are being downloaded.');
    else console.log('  ... ' + filename + ' downloaded successfully!');
  }
}

function getSubmittedCodes(submissionId, callback) {
  request.get(matrixRootUrl + '/one-submission-code?submissionId=' + submissionId, function(e, r, body) {
    var parseErr = null;
      try {
        body = JSON.parse(body);
      } catch (e) {
        parseErr = e;
      }
      if (parseErr || (body && body.err)) {
        var bodyErr = (body && body.err) ? new Error(body.msg) : null;
        var err = (parseErr) ? parseErr : bodyErr;
        if (parseErr) informParseErr(err, 'submitted codes body');
        else if (bodyErr) informBodyErr(err);
        if (callback) return callback(err, filename);
        else throw err;
      }
      parseErr = null;
      if (callback) callback(null, body.data);
      else return;
  });
}

function submitAnswer(problemId, submitAt, filesToSubmit, callback) {
  // submitAt = '2016-06-11T06:46:26.000Z';
  // return console.log(problemId, submitAt, filesToSubmit);
  request.post({
    'url': matrixRootUrl + '/one-submission',
    'form': {
      'codeFiles': filesToSubmit,
      'problemId': problemId,
      'userId': userId
    }
  }, function(e, r, body) {
    var body = JSON.parse(body);
    if (body.err) console.log('\nError:', body.msg);
    return callback(body.err, body.data);
  });
}

function getSubmissionTimeFromUser(callback) {
  if (chinese) {
    console.log('请设置您代码的提交时间');
    console.log('或者 [敲下回车] 跳过');
    console.log('  *** 格式: 输入 "2016 6 10 1 03 04" 代表 "2016/06/10 01:03:04"');
  } else {
    console.log('Please set the time you would like to submit your codes.');
    console.log('or [simply press Enter] to skip.');
    console.log('  *** Format: inputting "2016 6 10 1 03 04" sets submission time to "2016/06/10 01:03:04"');
  }
  prompt.get([{
      "name": 'submitDate',
      "description": (chinese) ? '提交时间 (可选)' : 'submitting time (optional)',
      "type": 'string',
      "pattern": /^(( ){0,}[0-9]{1,4}( ){0,}){0,6}$/,
      "before": function(submitDate) {return submitDate.split(' ');}
    }], function(err, result) {
      if (err) throw err;
      var rawSubmitDate = result.submitDate, submitDate = null;
      if (rawSubmitDate.length != 1 || rawSubmitDate[0] != '') {
        submitDate = new Date();
        var i = 0, temp = '';
        
        while (rawSubmitDate[i] && rawSubmitDate[i].length == 0) ++i;
        if (rawSubmitDate[i] == undefined) {
          submitDate = undefined;
        } else {

          temp = rawSubmitDate[i].replace(/^0*/g, '');
          if (temp.match(/^(\d){4}$/)) submitDate.setFullYear(temp), ++i;
          else submitDate = undefined;

          var suffix = ['Month', 'Date', 'Hours', 'Minutes', 'Seconds'];
          var range = [[1, 12], [1, 31], [0, 23], [0, 59], [0, 59]];
          var validate = function(num, j) {
            if (range[j][0] <= num && num <= range[j][1]) return num;
            else return undefined;
          };

          for (var j = 0; submitDate != undefined && j != 5; ++j) {
            while (rawSubmitDate[i] && rawSubmitDate[i].length == 0) ++i;
            temp = rawSubmitDate[i];
            if (temp === undefined) {
              submitDate = undefined;
            } else if (temp.match(/^(\d){1,2}$/) && (temp = validate(temp, j)) != undefined) {
              var originMonth = null;
              if (j == 1) originMonth = submitDate.getMonth();
              submitDate['set' + suffix[j]](temp - !j);
              if (j == 1 && submitDate.getMonth() != originMonth) submitDate = undefined;
              ++i;
            } else {
              submitDate = undefined;
            }
          }
        }
      }
      if (submitDate === undefined) {
        if (chinese) console.log('那是非法的提交时间！请重试。');
        else console.log('Invalid submission time. Please try again.');
        return getSubmissionTimeFromUser(callback);
      } else {
        if (submitDate === null) return callback(null, submitDate);
        else console.log(((chinese) ? '确定要在这个时间提交' : 'Are you sure you want to submit at'), submitDate.toLocaleString(), '?');
        prompt.get([{
          "name": 'confirm',
          "description": '[y/n]'
        }], function(err, result) {
          if (err) throw err;
          if (result.confirm == 'y' || result.confirm == 'Y' || result.confirm == 'yes'
              || result.confirm == 'Yes' || result.confirm == 'YES') {  // yes
              return callback(null, submitDate);
          } else {
            if (chinese) console.log('那再输入一次吧');
            else console.log('Then you might want to input again');
            return getSubmissionTimeFromUser(callback);
          }
        });
      }
    });
}


function packFiles(filename, codes, filesToSubmit, expectedFileNum, cntFileRead, callback) {
  if (codes !== null) {
    filesToSubmit[filename] = codes, ++filesToSubmit.fileNum;
  }
  if (filesToSubmit.fileNum == expectedFileNum) {
    return callback(null, filesToSubmit);
  } else if (cntFileRead == expectedFileNum) {
    return callback(new Error('Too few files to submit'));
  } else return;
}

function getCodeFilesFromUser(codeFilenames, filesToSubmit, expectedFileNum, callback) {
  prompt.start();
  console.log('');

  if (chinese) console.log('请把对应的代码文件拖到这里');
  else console.log('Please drag and drop the code files into here');
  var filePrompt = [];
  for (i in codeFilenames) {
    var oneFilePrompt = {
      "name": codeFilenames[i],
      "type": 'string',
      "required": true,
      "before": function(file) {return file.split(' ');}
    };
    filePrompt.push(oneFilePrompt);
  }
  prompt.get(filePrompt, function(err, result) {
    if (err) throw err;
    var invalidFileNames = [];
    var cntFileRead = 0;
    for (i in codeFilenames) {
      var rawNames = result[codeFilenames[i]], skip = 0;
      var numOfRawNames = rawNames.length;

      for (j in rawNames) {
        if (skip) {
          --skip;
          continue;
        }
        var completeFilename = rawNames[j], length = completeFilename.length;

          // sanitize filenames. Badly needs improvement
        if (windows) {
          while (completeFilename[0] == '"' && (completeFilename[length - 1] != '"' || length == 1)) {
            /** if the filename begins with but not ends with a quotation mark ["]
              * it's not complete,
              * like ["my output.txt"] being split into two parts: ["my] and [output.txt"]
              * we should concatenate them.
              * we have got ["my], and we should get the other part [output.txt"] now.
              * obviously, rawNames[j + 1] is the other part [output.txt"],
              * and we can now concatenate ["my] + [ ] + [output.txt"],
              *                           completeFilename  ' '  rawNames[j + 1]
              *                                   --- with completeFilename += (' ' + rawNames[j + j]);
              * therefore we got ["my output.txt"]
              * use "skip" to skip the ordinary loop that would have fetched us [output.txt"]
              */
            ++skip;
            if (j + 1 == numOfRawNames) break;  // or rawFile[j + 1] would be undefined
            else completeFilename += (' ' + rawNames[++j]);
            length = completeFilename.length;
          }
        } else if (mac) {
            /** if the filename doesn't begin with ["] or [']
              * but ends with \
              * it's not complete,
              * like [my\ output.txt] being split into two parts: [my\] and [output.txt]
              * we should concatenate them and remove the [\] which is used to mark white spaces
              * we have got [my\], and we should get the other part [output.txt] now.
              * obviously, rawNames[j + 1] is the other part [output.txt"],
              * and we can now concatenate [my]         +         [ ] + [output.txt]
              *                   completeFilename[0]~completeFilename[length - 2]  ' '  rawNames[j + 1]
              *                          --- with completeFilename = (completeFilename.substring(0, length - 1) + ' ' + rawNames[j + 1]);
              * therefore we got [my output.txt]
              * use "skip" to skip the ordinary loop that would have fetched us [output.txt]
              */
          if (completeFilename[0] != '"' && completeFilename[0] != "'") {
            while (completeFilename[length - 1] == '\\') {
              ++skip;
              if (j + 1 == numOfRawNames) break;  // or rawFile[j + 1] would be undefined
              completeFilename = (completeFilename.slice(0, -1) + ' ' + rawNames[++j]);
              length = completeFilename.length;
            }
          } else {
              /** if the filename begins with ["] but not ends with ["]
                * or the filename begins with ['] but not ends with [']
                * it's not complete
                * the algorithm is the same as the one for windows above
                */
            while ((completeFilename[0] == '"' && (completeFilename[length - 1] != '"' || length == 1))
              || (completeFilename[0] == "'" && (completeFilename[length - 1] != "'" || length == 1))) {
              ++skip;
              if (j + 1 == numOfRawNames) break;
              else completeFilename += (' ' + rawNames[++j]);
              length = completeFilename.length;
            }
          }
        } else if (ubuntu) {
            // almost the same as on Mac
            // except for the absence of the removal of [\]
            // and dealing with patterns at the end of the split filename like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
              // 
          if (completeFilename[0] != '"' && completeFilename[0] != "'") {
            while (completeFilename[length - 1] == '\\') {
              ++skip;
              if (j + 1 == numOfRawNames) break;  // or rawFile[j + 1] would be undefined
              completeFilename = (completeFilename.slice(0, -1) + '\\ ' + rawNames[++j]);
              length = completeFilename.length;
            }
          } else {
            while ((completeFilename[0] == '"' && (completeFilename[length - 1] != '"' || length == 1 || completeFilename.match(/((\"\\.\")|(\'\\.\'))$/)))
              || (completeFilename[0] == "'" && (completeFilename[length - 1] != "'" || length == 1 || completeFilename.match(/((\"\\.\")|(\'\\.\'))$/)))) {
                ++skip;
                if (j + 1 == numOfRawNames) break;
                else completeFilename += (' ' + rawNames[++j]);
              length = completeFilename.length;
            }
          }
        }

        if ((completeFilename[0] == "'" || completeFilename[0] == '"') && completeFilename[0] == completeFilename[length - 1]) {
          // if the filename begins and ends with quotation marks ['] or ["]
            // => remove them, as well as extra white spaces at the beginning and the end
          completeFilename = completeFilename.slice(1, -1).replace(/(^( *))|(( *)$)/g, '');

            // if it's on Ubuntu
              // deal with patterns like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
          if (ubuntu) completeFilename = removeUbuntuFilenameQuotationMarks(completeFilename, true);
        } else {
            // if it's on Mac and the filename doesn't begins or ends with ['] or ["]
              // remove unnecessary [\]
          if (mac) completeFilename = completeFilename.replace(/\\\\/g, '\t').replace(/\\/g, '').replace(/\t/g, '\\');
            // if it's on Ubuntu
              // remove unnecessary [\] and deal with patterns like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
          else if (ubuntu) completeFilename = removeUbuntuFilenameQuotationMarks(completeFilename, false);
        }
        // filename sanitization ends

        var filenameInfo = path.parse(completeFilename);
        var isValid = function(filename) {
          if (codeFilenames[i] == filename) return true;
          return false;
        };

        if (completeFilename != '') {
            // filename is valid => 
          if (chinese) console.log('准备提交 "' + filenameInfo.dir + (windows ? '\\' : '/') + filenameInfo.base + '" 中的内容');
          else console.log('Ready to submit the content of "' + filenameInfo.dir + (windows ? '\\' : '/') + filenameInfo.base + '"');
          
          readDataFrom(filenameInfo, codeFilenames[i], function(err, filenameInfo, filename, rawData) {
            ++cntFileRead;
            if (err) rawData = null;
            packFiles(filename, rawData, filesToSubmit, expectedFileNum, cntFileRead, function(err, files) {
              if (err) {
                console.log('\nError:', err.message);
                if (callback) callback(err);
                else throw err;
              } else {
                if (callback) return callback(null, files);
                else return files;
              }
            });
          });
        }
      }
    }
  });
}


function getListOfSubmissions(problemId, startPos, originData, callback) {
  request.get(matrixRootUrl + '/problem-submissions?position=' + startPos + '&problemId=' + problemId + '&userId=' + userId, function(e, r, body) {
    if (e) {
      console.log('\nError:', e.message, 'problemId = ', problemId);
      if (callback) return callback(e);
      else throw e;
    }
    var parseErr = null;
    try {
      body = JSON.parse(body);
    } catch (e) {
      parseErr = e;
    }
    if (parseErr || (body && body.err)) {
      var bodyErr = (body && body.err) ? new Error(body.msg) : null;
      var err = (parseErr) ? parseErr : bodyErr;
      if (parseErr) informParseErr(err, 'submission list body');
      else if (bodyErr) informBodyErr(err);
      if (callback) return callback(err);
      else throw err;
    }
    
    parseErr = null;

    var data = body.data;
    if (!data) {
      console.log('\nError: No submissinos available.');
      if (callback) return callback(new Error('No submissions available.'));
      else return;
    } else if (true) {
      data = originData.concat(data);
      printListOfSubmissions(data);
      return callback(null, data);
    } else {
      return getListOfSubmissions(problemId, parseInt(startPos) + 10, originData.concat(data), callback);
    }
  });
}

function printListOfSubmissions(info) {
  /** prefix one-digit number with a 0
    * @param date <string> "XXXX/YY/Y Y:YY:Y" representing submit time
    * @return <string> "XXXX/YY/0Y 0Y:YY:0Y"
    * 
    * private but independent
    */
  var prefixWithZero = function(date) {
    return date.replace(/(\/)(?=(\d)(\D))/g, '/0').replace(/( )(?=(\d)(\D))/g, ' 0').replace(/((\:)(?=(\d)(\D)))|((\:)(?=(\d)$))/g, ':0');
  };
  var maxIndexLength = String(info.length).length;
  var format = '%0' + maxIndexLength + 'd';

  console.log('');
  if (info.length) {
    for (i in info) {
      var one = info[i];
      console.log(sprintf('[' + format + ']', parseInt(i) + 1), 'at ' + prefixWithZero(submitAtString(one.submitAt)), 'with Grade ' + one.grade);
    }
  } else {
    console.log("You haven't submitted any codes for this Problem.");
  }
  console.log('');
}

function getSubmissionsIdFromUser(length, getAc, overwrite, callback) {
  prompt.start();
  if (chinese) {
    console.log('请输入 index Ids');
    // console.log('或者[敲下回车]下载未完成的 Problem');
    // console.log('  *** 注意：id 应该是一个数字，像 588');
    // console.log('  *** 允许一次输入多个 id，像 586 587 588，用空格将 id 隔开');
    // console.log('  *** 默认情况下，不获取正确(CR)的样例');
    // console.log('  *** 想获取正确的样例，您可以输入一个 "c" 或 "C" 作为 id');
    // console.log('  *** 这样，正确的样例会在 "c" 后面那些 Problem 的输出中显示');
    // console.log('  *** 也可以通过在 id 后面加一个 "c" 来指定要看哪些 Problem 的正确样例');
    // console.log('  *** 像 586 587c 588 c 5 6 7');
    // console.log('         => 586(不要CR) 587(要CR) 588(不要CR) 5(要CR) 6(要CR) 7(要CR)');
    // console.log('  *** 同理，输入 "w" 或 "W" 可以覆盖本地已储存的输出（默认不覆盖）');
    // console.log('  *** 您还可以输入 "!.js!"、"!.md!" 等作为[第一个 id ]来修改输出文件的后缀名');
    // console.log('\n  **** 内存检查的部分有可能导致程序编译出错，万一出错了，您可先输入 "m" 作为 id 取消该部分输出 ****');
  } else {
    console.log('Please input the index ');
    // console.log('or [simply press Enter] to fetch unfinished Problems');
    // console.log('  *** Note: a valid Problem Id is a number like 588');
    // console.log('  *** Multiple ids are allowed like 586 587 588, with ids separated by spaces');
    // console.log('  *** By default correct samples (CR) are not displayed');
    // console.log('  *** To check out correct samples, you may input an "c" or "C" as an id');
    // console.log('  *** and correct samples will be displayed in the output of Problems after the "c"');
    // console.log('  *** You may also append an "c" after an id the correct samples of which you would like to check out,');
    // console.log('  *** like 586 587c 588 c 5 6 7');
    // console.log('         => 586(No CR) 587(CR) 588(No CR) 5(CR) 6(CR) 7(CR)');
    // console.log('  *** Likewise, appending a "w" or "W" after an id would lead to overwriting the local file, which is not default');
    // console.log('  *** You may input "!.js!" or "!.md!" or ... as [the first id] to change the file extension of output');
    // console.log('\n  **** The part of Memory Check is likely to result in syntax error when the program is running. Should it be the case, it is suggested that you input an "m" as an id to skips this part. ****');
  }
  var getAc1 = getAc, overwrite1 = overwrite;
  prompt.get([{
    name: 'choices',
    type: 'string',
    before: function(choices) {return choices.split(' ');}
  }], function(err, result) {
    if (err) throw err;
    var fetched = false, getAcOutputAfter = getAc1, overwriteAfter = overwrite1, extensionSet = false;  // flag for unfinished problems
    var rawId = result.choices, countValidId = 0;
    // var idArray = new Array();
      // simply press Enter => fetch unfinished problems
    // if (rawId.length == 1 && rawId[0] == '') {

    // }
    for (i in rawId) {
      var oneId = rawId[i];
      // if (!extensionSet && oneId.match(/^\!\..{1,}\!$/)) {
        // extensionSet = true, outputExt = oneId.slice(1, -1);
      // } else if (!fetched && oneId.match(/^u$/)) {
      // if (oneId.match(/^[Mm]$/)) {
      //   cancelMemoryCheck = true;
      if (oneId.match(/^[Cc]$/)) {
        getAcOutputAfter = true;
      } else if (oneId.match(/^[Ww]$/)) {
        overwriteAfter = true;
      } else if (oneId.match(/^((\d){1,})[CcWw]{0,5}$/) && !oneId.match(/([CcWw])(?=.*\1)/)) {
        var getAc = false, overwrite = false;
        if (~oneId.indexOf('c') || ~oneId.indexOf('C')) getAc = true;
        if (~oneId.indexOf('w') || ~oneId.indexOf('W')) overwrite = true;
        var trueId = parseInt(oneId.replace(/[CcWw]/g, ''));

        if (0 < trueId && trueId <= length) {
          ++countValidId;
          callback(null, trueId, getAcOutputAfter || getAc, overwriteAfter || overwrite);
        } else {
          if (chinese) console.log('忽略非法id "' + oneId + '"');
          else console.log('invalid id "' + oneId + '" ignored');
          continue;
        }
      } else if (oneId != '') {  // else => ignore
        if (chinese) console.log('忽略非法id "' + oneId + '"');
        else console.log('invalid id "' + oneId + '" ignored');
      }
    }
      // no valid id input
    if (countValidId == 0 && !fetched) {
      if (chinese) console.log('无效输入！请重试...');
      else console.log('Bad input! Please try again...');
      return getSubmissionsIdFromUser(length, getAc, overwrite, callback);
    }
  });
}

function getListOfCurrentProblems(courseId, callback) {
  request.get(matrixRootUrl + '/exam-problems?examId=' + courseId + '&userId=' + userId, function(e, r, body) {
    if (e) {
      console.log('\nError:', e.message, 'examId = ', courseId);
      if (callback) return callback(e);
      else throw e;
    }

    var parseErr = null;
    try {
      body = JSON.parse(body);
    } catch (e) {
      parseErr = e;
    }
    if (parseErr || (body && body.err)) {
      var bodyErr = (body && body.err) ? new Error(body.msg) : null;
      var err = (parseErr) ? parseErr : bodyErr;
      if (parseErr) informParseErr(err, 'Problem list body');
      else if (bodyErr) informBodyErr(err);
      if (callback) return callback(err);
      else throw err;
    }
    
    parseErr = null;


    var data = body.data;
    if (!data) {
      console.log('\nError: No Problems available.');
      if (callback) return callback(new Error('No Problems available.'));
      else return;
    } else {
      printListOfCurrentProblems(data);
      return callback(null, data);
    }
  });
}

function printListOfCurrentProblems(info) {

  var format = '%d';

  console.log('');
  if (info.length) {
    info.sort(function(a, b) { return (a.title < b.title) ? -1 : ((a.title == b.title) ? 0 : 1); })
    for (i in info) {
      var one = info[i];
      console.log(sprintf(' Problem Id [' + format + ']:', one.id), ' ' + one.title);
    }
  } else {
    console.log("No Problems available.");
  }
  console.log('');
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
  //     informConnectionFailed(e);
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



function getOneProblemId(mode) {
  prompt.start();
  getListOfCurrentProblems(6, function(err) {
    if (chinese) {
      console.log("请输入一个 Problem Id");
      // console.log('或者[敲下回车]下载未完成的 Problem');
      console.log('  *** id：Id 应该是一个数字，像 588，不支持多 Id');
      console.log('  *** 选项："c" 或 "C" 获取正确(CR)样例，"w" 或 "W" 覆盖本地已储存的输出，');
      console.log('           可叠加，可以按回车跳过');
      console.log('  *** 输出文件的扩展名：如 ".js"、".md"，可以按回车跳过');
      // // console.log('  *** 允许一次输入多个 id，像 586 587 588，用空格将 id 隔开');
      // console.log('  *** 默认情况下，不获取正确(CR)的样例');
      // console.log('  *** 想获取正确的样例，您可以输入一个 "c" 或 "C" 作为 id');
      // console.log('  *** 这样，正确的样例会在 "c" 后面那些 Problem 的输出中显示');
      // console.log('  *** 也可以通过在 id 后面加一个 "c" 来指定要看哪些 Problem 的正确样例');
      // // console.log('  *** 像 586 587c 588 c 5 6 7');
      // console.log('         => 586(不要CR) 587(要CR) 588(不要CR) 5(要CR) 6(要CR) 7(要CR)');
      // console.log('  *** 同理，输入 "w" 或 "W" 可以覆盖本地已储存的输出（默认不覆盖）');
      // console.log('  *** 您还可以输入 "!.js!"、"!.md!" 等作为[第一个 id ]来修改输出文件的后缀名');
      // console.log('\n  **** 内存检查的部分有可能导致程序编译出错，万一出错了，您可先输入 "m" 作为 id 取消该部分输出 ****');
    } else {
      console.log("Please input the Problem Id");
      // console.log('or [simply press Enter] to fetch unfinished Problems');
      console.log('  *** Note: a valid Problem Id is a number like 588');
      // console.log('  *** Multiple ids are allowed like 586 587 588, with ids separated by spaces');
      // console.log('  *** By default correct samples (CR) are not displayed');
      // console.log('  *** To check out correct samples, you may input an "c" or "C" as an id');
      // console.log('  *** and correct samples will be displayed in the output of Problems after the "c"');
      // console.log('  *** You may also append an "c" after an id the correct samples of which you would like to check out,');
      // console.log('  *** like 586 587c 588 c 5 6 7');
      // console.log('         => 586(No CR) 587(CR) 588(No CR) 5(CR) 6(CR) 7(CR)');
      // console.log('  *** Likewise, appending a "w" or "W" after an id would lead to overwriting the local file, which is not default');
      // console.log('  *** You may input "!.js!" or "!.md!" or ... as [the first id] to change the file extension of output');
      // console.log('\n  **** The part of Memory Check is likely to result in syntax error when the program is running. Should it be the case, it is suggested that you input an "m" as an id to skips this part. ****');
    }
    prompt.get([{
      'name': 'id',
      'type': 'string',
      'pattern': /^( ){0,}(\d){1,}( ){0,}$/,
      'required': true,
      'before': function(id) { return id.split(' '); } 
    }, {
      'name': 'options',
      'description': (chinese) ? '选项 (可选)' : 'options (optional)',
      'type': 'string',
      'pattern': /^([CcWw]{1}( ){0,1}){0,2}$/
    }, {
      'name': 'ext',
      'description': (chinese) ? '输出文件的扩展名 (可选)' : 'output file extension (optional)',
      'type': 'string',
      'pattern': /(^\..{1,}$)|(^$)/
    }], function(err, result) {
      if (err) throw err;
      var getAc = false, overwrite = false, countValidId = 0;
      if (result.options.length) {
        var options = result.options;
        if (options.match(/[Cc]/)) getAc = true;
        if (options.match(/[Ww]/)) overwrite = true;
      }
      if (result.ext.length) outputExt = result.ext;
      var rawId = result.id;
      for (i in rawId) {
        var oneId = rawId[i];
        if (oneId.match(/^((\d){1,})$/)) {
          var problemId = oneId.replace(/^0*/g, '');
          if (problemId.length == 0) continue;
          ++countValidId;
          return FetchOne(oneId.replace(/^0*/g, ''), false, getAc, overwrite, mode);
        } else {
          if (oneId.length == 0) continue; 
          if (chinese) console.log('忽略非法id "' + oneId + '"');
          else console.log('invalid id "' + oneId + '" ignored');
        }
      }
        // no valid id input
      if (countValidId == 0) {
        if (chinese) console.log('无效输入！请重试...');
        else console.log('Bad input! Please try again...');
        getOneProblemId(mode);
      }
    });
  });
  
}

function getAssignmentsId(mode) {
  prompt.start();
  getListOfCurrentProblems(6, function(err) {
    if (chinese) {
      console.log("请输入 Problem Id");
      // console.log('或者[敲下回车]下载未完成的 Problem');
      console.log('  *** 注意：id 应该是一个数字，像 588');
      console.log('  *** 允许一次输入多个 id，像 586 587 588，用空格将 id 隔开');
      console.log('  *** 默认情况下，不获取正确(CR)的样例');
      console.log('  *** 想获取正确的样例，您可以输入一个 "c" 或 "C" 作为 id');
      console.log('  *** 这样，正确的样例会在 "c" 后面那些 Problem 的输出中显示');
      console.log('  *** 也可以通过在 id 后面加一个 "c" 来指定要看哪些 Problem 的正确样例');
      console.log('  *** 像 586 587c 588 c 5 6 7');
      console.log('         => 586(不要CR) 587(要CR) 588(不要CR) 5(要CR) 6(要CR) 7(要CR)');
      console.log('  *** 同理，输入 "w" 或 "W" 可以覆盖本地已储存的输出（默认不覆盖）');
      console.log('  *** 您还可以输入 ".js"、".md" 等来设置输出文件的后缀名，或者[敲下回车]跳过');
      // console.log('\n  **** 内存检查的部分有可能导致程序编译出错，万一出错了，您可先输入 "m" 作为 id 取消该部分输出 ****');
    } else {
      console.log("Please input the Problem Id");
      // console.log('or [simply press Enter] to fetch unfinished Problems');
      console.log('  *** Note: a valid Problem Id is a number like 588');
      console.log('  *** Multiple ids are allowed like 586 587 588, with ids separated by spaces');
      console.log('  *** By default correct samples (CR) are not displayed');
      console.log('  *** To check out correct samples, you may input an "c" or "C" as an id');
      console.log('  *** and correct samples will be displayed in the output of Problems after the "c"');
      console.log('  *** You may also append an "c" after an id the correct samples of which you would like to check out,');
      console.log('  *** like 586 587c 588 c 5 6 7');
      console.log('         => 586(No CR) 587(CR) 588(No CR) 5(CR) 6(CR) 7(CR)');
      console.log('  *** Likewise, appending a "w" or "W" after an id would lead to overwriting the local file, which is not default');
      console.log('  *** You may input ".js" or ".md" or ... to set the file extestion of output, or [simply press Enter] to skip');
      // console.log('\n  **** The part of Memory Check is likely to result in syntax error when the program is running. Should it be the case, it is suggested that you input an "m" as an id to skips this part. ****');
    }
    prompt.get([{
      name: 'id',
      type: 'string',
      before: function(id) {return id.split(' ');}
    }, {
      'name': 'ext',
      'description': (chinese) ? '输出文件的扩展名 (可选)' : 'output file extension (optional)',
      'type': 'string'
    }], function(err, result) {
      if (err) throw err;
      var fetched = false, getAcOutputAfter = false, overwriteAfter = false;  // flag for unfinished problems
      var rawId = result.id, countValidId = 0;
      // var idArray = new Array();
      if (result.ext.length) {
        var ext = result.ext;
        if (ext.match(/^\..{1,}$/)) {
          submissionOutputExtension = ext;
        }
      }
        // simply press Enter => fetch unfinished problems
      // if (rawId.length == 1 && rawId[0] == '') {

      // }
      for (i in rawId) {
        var oneId = rawId[i];
        // if (!extensionSet && oneId.match(/^\!\..{1,}\!$/)) {
        //   extensionSet = true, submissionOutputExtension = oneId.slice(1, -1);
        // } else if (!fetched && oneId.match(/^u$/)) {
        // } else if (oneId.match(/^[Mm]$/)) {
        //   cancelMemoryCheck = true;
        if (oneId.match(/^[Cc]$/)) {
          getAcOutputAfter = true;
        } else if (oneId.match(/^[Ww]$/)) {
          overwriteAfter = true;
        } else if (oneId.match(/^((\d){1,})[CcWw]{0,5}$/) && !oneId.match(/([CcWw])(?=.*\1)/)) {
          ++countValidId;
          var getAc = false, overwrite = false;
          if (~oneId.indexOf('c') || ~oneId.indexOf('C')) getAc = true;
          if (~oneId.indexOf('w') || ~oneId.indexOf('W')) overwrite = true;
          FetchOne(oneId.replace(/[CcWw]/g, ''), false, getAcOutputAfter || getAc, overwriteAfter || overwrite, mode);
        } else if (oneId != '') {  // else => ignore
          if (chinese) console.log('忽略非法id "' + oneId + '"');
          else console.log('invalid id "' + oneId + '" ignored');
        }
      }
        // no valid id input
      if (countValidId == 0 && !fetched) {
        if (chinese) console.log('无效输入！请重试...');
        else console.log('Bad input! Please try again...');
        getAssignmentsId(mode);
      }
    });
  });
}

function menu() {
  prompt.start();
  console.log('=========== Menu =============');
  console.log('[1] submit codes');
  console.log('[2] download specific submission outputs');
  console.log('[3] download latest submission outputs');
  console.log('[4] download problems');
  console.log('[5] download submitted codes');
  console.log('[0] quit');
  prompt.get([{
    'name': 'choice',
    'description': 'choice',
    'type': 'string',
  }], function(err, result) {
    if (err) throw err;
    var choice = result.choice;
    if (choice.length != 1) {
      return console.log('try again'), menu();
    } else {
      if (parseInt(choice) == 0) return;
      if (parseInt(choice) == 1) return getOneProblemId(modes.submitCodes);
      else if (parseInt(choice) == 2) return getOneProblemId(modes.specificOutput);
      else if (parseInt(choice) == 3) return getAssignmentsId(modes.latestOutput);
      else if (parseInt(choice) == 4) return getAssignmentsId(modes.downloadProblem);
      else if (parseInt(choice) == 5) return getOneProblemId(modes.downloadSubmittedCodes);
      else return console.log('try again'), menu();
    }
  });
}



/* ================= Phase 1: login =================== */

function saveUsernameAndPassword(info, fromData, password) {
  if (chinese) console.log('用户', info.nickname, '登录成功 (用户名: ' + username + ')');
  else console.log('Logged in as ' + info.nickname + ' (username: ' + username + ')');
  if (fromData) {
      // login with the combination from usersDataManager => get Id directly
    return menu();
  } else {
      // login with the user-input combination
      //   => allow user to store the new combination
    prompt.start();
    if (chinese) console.log('是否要在本地保存用户名（和密码）？');
    else console.log('Would you like to store the username (and password) locally?');
    prompt.get([{
      "name": 'store',
      "description": '[y/n]'
    }], function(err, result) {
      if (err) throw err;
      if (result.store == 'y' || result.store == 'Y' || result.store == 'yes'
          || result.store == 'Yes' || result.store == 'YES') {  // yes
        usersDataManager.addAccount(username, password);
        usersDataManager.writeDataTo(usersdataFilename, function(err) {
          if (err) return menu();
          if (chinese) console.log('... 保存成功\n');
          else console.log('... successfully stored\n');
          return menu();
        });
      } else {  // not to store
        if (chinese) console.log('未保存\n');
        else console.log('Not stored\n');
        return menu();
      }
    });
  }
}

function loginMatrix(fromData, loginUsername, password) {
  if (chinese) console.log('正在登录....');
  else console.log("Logging in....");
  request.get(matrixRootUrl + '/one-user?password=' + password + '&username=' + loginUsername, function(e, response, body) {
    if (e) return informConnectionFailed(e);
    var parseErr = null;
    try {
      body = JSON.parse(body);
    } catch (e) {
      parseErr = e;
    }
    if (parseErr) {
      informParseErr(parseErr, 'login result');
      if (chinese) console.log("出现错误，请重试 :(");
      else console.log("Error occurred. Please retry :(");
      return chooseAccount();
    }
    parseErr = null;
    if (body.err) {
      var errorText = body.msg, incorrectCombi = false;  // incorrect username and password combination
      console.log('\nError:', errorText);
      if (chinese) console.log("登录失败，请重试 :(");
      else console.log("Login failed. Please retry :(");
      if (~errorText.indexOf('登录失败，你去找TA确认你的信息是否被导入')
        || ~errorText.indexOf('登录失败，密码错了傻逼')) incorrectCombi = true;
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
    username = loginUsername, userId = body.data.id, savePath = './saved/' + username;
    var data = null, studentId = null, nickname = null, realname = null;
    try {
      data = body.data, studentId = data.studentId, nickname = data.nickname, realname = data.realname;
    } catch (e) {
      console.log('\nError:', e.message);
    }
    var info = {'username': username,
               'nickname': nickname,
               'realname': realname,
               'userId': userId,
               'studentId': studentId};
    printUserInfo(info);
    return saveUsernameAndPassword(body.data, fromData, password);
  });
}

function getUserInfoByUsername(username, callback) {
  request.get(matrixRootUrl + '/one-user?username=' + username, function(e, r, body) {
    if (e) {
      console.log('\nError: Username is not found.');
      if (callback) return callback(new Error('Username is not found.'));
      else return;
    }
    var parseErr = null;
    try {
      body = JSON.parse(body);
    } catch (e) {
      parseErr = e;
    }
    if (parseErr || (body && body.err)) {
      var bodyErr = (body && body.err) ? new Error(body.msg) : null;
      var err = (parseErr) ? parseErr : bodyErr;
      if (parseErr) informParseErr(err, 'user info');
      else if (bodyErr) informBodyErr(err);
      return callback(err);
    }
    parseErr = null;
    var ans = null, userId = null, studentId = null, nickname = null, notifications = null;
    try {
      ans = body.ans, userId = ans.id, studentId = ans.studentId, nickname = ans.nickname, notifications = ans.notifications;
    } catch (e) {
      console.log('\nError:', e.message);
      return callback(e);
    }
    return callback(null, {'username': username,
                           'nickname': nickname,
                           'userId': userId,
                           'studentId': studentId,
                           'notifications': notifications});

  });
}

function printUserInfo(info) {
  console.log('\n  username:', info.username, '\n',
              ' nickname:', info.nickname, '\n',
              ' realname:', info.realname, '\n',
              '   userId:', info.userId, '\n',
              'studentId:', info.studentId, '\n');
  
}

function getUsernameAndPassword(chosenUser, requirePassword, fromData) {
  var getCallback = function(err, result) {
    if (err) throw err;
    if (result.password) {
      return loginMatrix(false, result.username, getMD5(result.password));
    } else {
      console.log('non-password mode');
      return getUserInfoByUsername(result.username, function(err, info) {
        if (err) {
          if (err.message == 'Username is not found.') {
            return usersDataManager.removeAccountByUsername(result.username, function() {
              return chooseAccount();
            });
          } else {
            console.log('user info incomplete. Please try again with a password.');
            return getUsernameAndPassword({'username': result.username, 'password': undefined}, true, fromData);
          }
        }
        if (info.userId) userId = info.userId;
        if (info.username) username = info.username, savePath = './saved/' + username;
        printUserInfo(info);
        return saveUsernameAndPassword(info, fromData, undefined);
      });
    }
  };
  var usernamePrompt = [{
    'name': 'username',
    'description': (chinese) ? '用户名' : 'username',
    'required': true
  }], passwordPrompt = [{
    'name': 'password',
    'description': ((chinese) ? '密码' : 'password'),
    'hidden': true,
    'replace': '*',
    'required': requirePassword
  }];
  prompt.start();
  if (chosenUser.username) {
    if (chosenUser.password) return loginMatrix(true, chosenUser.username, chosenUser.password);
    if (requirePassword) return prompt.get(passwordPrompt, function(err, result) {
        if (err) throw err;
        else return getCallback(null, {'username': chosenUser.username, 'password': result.password});
      });
    else return getCallback(null, {'username': chosenUser.username, 'password': undefined});
  } else {
    if (requirePassword) prompt.get(usernamePrompt.concat(passwordPrompt), getCallback);
    else return prompt.get(usernamePrompt, getCallback);
  }
}

function chooseAccount() {
  var total = usersDataManager.total;
  if (total == 0) {  // no users data stored locally => obtain username and password from user
    getUsernameAndPassword({'username': undefined, 'password': undefined}, true, false);
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
      'name': 'choice',
      'description': (chinese) ? '序号' : 'choice',
      'type': 'string'
    }], function(err, result) {
      if (err) throw err;
      if (result.choice == '') {
          // simply press Enter => obtain username and password from user
        return getUsernameAndPassword({'username': undefined, 'password': undefined}, true, false);
      } else if (1 <= parseInt(result.choice) && parseInt(result.choice) <= total) {
          // valid index => obtain username and password from the chosen account
        return getUsernameAndPassword(usersDataManager.getAccountByListedIndex(parseInt(result.choice)), true, true);
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

/* ================= Phase 1 ends =================== */

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function UsersDataManager(filename, callback) {
    // this => *this && public
  this.data = null;
  this.total = 0;
  this.template = {"users": [], "config": {"outputExt": '.txt'}};
  var self = this;
  UsersDataManager.prototype.writeDataTo = function(filename, callback) {
    writeFile('./' + filename, JSON.stringify(this.data), function(err) {
      if (callback) callback(err);
      else throw err;
    });
  };
  UsersDataManager.prototype.readDataFrom = function(filename, callback) {
    fs.stat(filename, function(err, stat) {
      if (err) {
          // create an empty usersDataManager object
        self.data = self.template;
        self.total = self.data.users.length;
        if (callback) callback(null);
      } else {
          // read the file
        fs.readFile(filename, 'utf-8', function(err, rawData) {
          if (err) {
            if (callback) console.log('\nError:', err.code, err.message), callback(err);
            else throw err;
          } else {
            var toUpdate = false;
            var fixUndefined = function(body, item) {
              if (body) {
                if (self.data[body][item] == undefined) self.data[body][item] = self.template[body][item], toUpdate = true;
              } else {
                if (self.data[item] == undefined) self.data[item] = self.template[item], toUpdate = true;
              }
            };
              // create a usersDataManager object from the file
            try {  
              self.data = JSON.parse(rawData);
              self.total = 0;
              for (i in self.data.users)
                if (self.data.users[i].username.length && (self.data.users[i].password == undefined || self.data.users[i].password.length)) ++self.total;
              fixUndefined(null, 'config');
              fixUndefined('config', 'outputExt');
              outputExt = self.data.config.outputExt;

              if (toUpdate) self.writeDataTo(usersdataFilename, function(err) {});

            } catch (e) {
              console.log('\nError:', e.code + ": " + e.message);
              if (chinese) console.log('  *** 错误：' + filename + ' 文件似乎被修改过，无法被解释器识别了。\
原来的 ' + filename + ' 文件将会在下一次储存用户名密码的时候被覆盖。');
              else console.log('  *** Error: It seems that data stored in ' + filename + ' have \
been modified and could not be recognized any more. \
The orginal ' + filename + ' file will get overwritten when \
new username and password patterns are allowed to stored.');
              self.data = self.template;
              self.total = self.data.users.length;
              outputExt = self.data.config.outputExt.substr(0);
              if (callback) return callback(null);
              else throw e;
            }
            if (callback) callback(null);
          }
        });
      }
    });
  };
  
  UsersDataManager.prototype.listUsernames = function() {
    var maxIndexLength = String(this.total).length;
    var format = '%0' + maxIndexLength + 'd';
    for (var i = 0; i < this.total; ++i) {
      console.log('[' + sprintf(format, (parseInt(i) + parseInt(1))) + ']', this.data.users[i].username);
    }
  };
  UsersDataManager.prototype.findAccountByUsername = function(username) {
    for (var i = 0; i < this.total; ++i) {
      if (username == this.data.users[i].username) return i;
    }
      // not found: return a new index which makes it convenient to create a account
    return this.total;
  };
  UsersDataManager.prototype.addAccount = function(username, password) {
    this.data.users[this.findAccountByUsername(username)] = {
      "username": username,
      "password": password
    }
    this.total = this.data.users.length;
  };
  UsersDataManager.prototype.getAccountByListedIndex = function(index) {
    if (1 <= index && index <= this.total) return this.data.users[index - 1];
    else return {"username": '', "password": ''};
  };
  UsersDataManager.prototype.removeAccountByUsername = function(username, callback) {
    this.data.users[this.findAccountByUsername(username)]
      = this.data.users[this.total - 1];
    this.data.users.pop();
    this.total = this.data.users.length;
    this.writeDataTo(usersdataFilename, function(err) {
      if (err) {
        if (chinese) console.log('\n保存失败\n');
        else console.log('\nFailed to store\n');
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

request.get(matrixRootUrl, function(err, response, body) {
  if (err) return informConnectionFailed(err);
  new UsersDataManager(usersdataFilename, function(err, self) {
    if (err) return;
    else return usersDataManager = self, welcome();
  });
});
