var windows = false;
var chinese = false;

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

var matrixRootUrl = 'https://eden.sysu.edu.cn';
var usersdataFilename = '.usersdata';
var submissionOutputExtension = '.txt';
var username = '', userId = '', usersDataManager = null, savePath = './saved';

var cancelMemoryCheck = false;

function getMD5(data) { return crypto.createHash('md5').update(data).digest('hex'); }

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

function fetchLatestSubmissionOutput(problemId, foldername, getAc, overwrite, callback) {
  var suffixTime = '';

  // get submission time
  request.get(matrixRootUrl + '/get-one-assignment-info?position=0&problemId=' + problemId + '&status=2&userId=' + userId, function(e, r, body) {
  
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
    var parseErr = null;
    try {
      body = JSON.parse(body);
    } catch (e) {
      parseErr = e;
    }
    if (e || parseErr || body.err || !body.data.length) {
      var date = new Date();
      suffixTime = prefixWithZero('downloaded at ' + date.getFullYear() + '/' + (parseInt(date.getMonth()) + 1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds());
    } else {
      var latest = body.data[0];
      suffixTime = prefixWithZero('at ' + latest.submitAt);
    }

    // get report json
    request.get(matrixRootUrl + '/get-last-submission-report?problemId=' + problemId + '&userId=' + userId, function(e, r, body) {
    
    /* for debug */
    // request.get('https://eden.sysu.edu.cn/get-submission-by-id?submissionId=' + 3862, function(e, r, body) {  
    /* end */

      /** if connection failed
        *  => skip current problemId
        */
      if (e) {
        console.log('\nError:', e.message, 'problemId = ', problemId);
        if (callback) return callback(e);
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
        if (callback) return callback(err);
        else throw err;
      }
      
      
      parseErr = null;

      /** data: {grade, report}
        * content: the final result to be written into file
        */
      var data = body.data[0], content = '';

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
        if (callback) return callback(existenceError);
        else return;
      }

      /** grade: total scores
        * report: consists of the five phases
        */
      var grade = data.grade, report = null;

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
        if (callback) return callback(parseErr);
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
        if (callback) return callback(existenceError);
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
              var prefix = ((your) ? 'Your ' : ' Std ');

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
            if (test.error || test.message != 'Program finished running.') {
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
              content += '          Answer:\n' + wrapBorder(addLinenum(wrap(stdout)), 9) + '\n';
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
        if (tests[0] && tests[0].message == "Malicious code detected! This unusual behavior will be recorded  by the system") {
          content += '\nError: ' + tests[0].message + '\n';
          return;
        }
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
      createFile(overwrite, savePath + '/' + foldername + '/' + 'Latest Submission Outputs/' + problemId + ' Output ' + ((getAc) ? '(including CR) ' : '') + suffixTime + submissionOutputExtension, content, function(err) {
        if (callback) return callback(err);
        else return;
      });
    });
  });
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

function FetchOne(problemId, tobeDone, getAc, overwrite, callback) {
  request.get(matrixRootUrl + '/get-problem-by-id?problemId=' + problemId, function(e, r, body) {
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
    var data = body.data, config = JSON.parse(data.config), supportFiles = data.supportFiles;
    var title = data.title, c11 = false;
    if (config.compilers['c++']) c11 = Boolean(~config.compilers['c++'].command.indexOf('-std=c++11'));
    var author = data.author, memoryLimit = config.limits.memory + 'MB', timeLimit = config.limits.time + 'ms';
    var error = null;
    // // for (var id = 1; id != 1000; ++id)
    // var id = [944, 941, 953];
    // for (i in id)
                              // here
    fetchLatestSubmissionOutput(problemId, problemId + ' ' + title, getAc, overwrite, function(err) {
      var error = null;
      if (err) error = err;
      informFetchResult(error, problemId);
      if (callback) return callback();
    });
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

function UsersDataManager(filename, callback) {
    // this => *this && public
  this.data = null;
  this.total = 0;
  var self = this;
  UsersDataManager.prototype.readDataFrom = function(filename, callback) {
    fs.stat(filename, function(err, stat) {
      if (err) {
          // create an empty usersDataManager object
        self.data = {'users': [], 'config': {'submissionOutputExtension': '.txt'}};
        self.total = self.data.users.length;
        if (callback) callback(null);
      } else {
          // read the file
        fs.readFile(filename, 'utf-8', function(err, rawData) {
          if (err) {
            if (callback) console.log('\nError:', err.code, err.message), callback(err);
            else throw err;
          } else {
              // create a usersDataManager object from the file
            try {  
              self.data = JSON.parse(rawData);
              self.total = 0;
              submissionOutputExtension = self.data.config.submissionOutputExtension.substr(0);
              for (i in self.data.users)
                if (self.data.users[i].username.length && self.data.users[i].password.length) ++self.total;
            } catch (e) {
              console.log('\nError:', e.code + ": " + e.message);
              if (chinese) console.log('  *** 错误：' + filename + ' 文件似乎被修改过，无法被解释器识别了。\
原来的 ' + filename + ' 文件将会在下一次储存用户名密码的时候被覆盖。');
              else console.log('  *** Error: It seems that data stored in ' + filename + ' have \
been modified and could not be recognized any more. \
The orginal ' + filename + ' file will get overwritten when \
new username and password patterns are allowed to stored.');
              self.data = {'users': [], 'config': {'submissionOutputExtension': '.txt'}};
              self.total = self.data.users.length;
              submissionOutputExtension = self.data.config.submissionOutputExtension.substr(0);
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
    writeFile('./' + filename, JSON.stringify(this.data), function(err) {
      if (callback) callback(err);
      else throw err;
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
    ++(this.total);
  };
  UsersDataManager.prototype.getAccountByListedIndex = function(index) {
    if (1 <= index && index <= this.total) return this.data.users[index - 1];
    else return {'username': '', 'password': ''};
  };
  UsersDataManager.prototype.removeAccountByUsername = function(username, callback) {
    this.data.users[this.findAccountByUsername(username)]
      = this.data.users[this.total - 1];
    this.data.users.pop();
    --(this.total);
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

function getAssignmentsId() {
  prompt.start();
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
    console.log('  *** 您还可以输入 "!.js!"、"!.md!" 等作为[第一个 id ]来修改输出文件的后缀名');
    console.log('\n  **** 内存检查的部分有可能导致程序编译出错，万一出错了，您可先输入 "m" 作为 id 取消该部分输出 ****');
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
    console.log('  *** You may input "!.js!" or "!.md!" or ... as [the first id] to change the file extestion of output');
    console.log('\n  **** The part of Memory Check is likely to result in syntax error when the program is running. Should it be the case, it is suggested that you input an "m" as an id to skips this part. ****');
  }
  prompt.get([{
    name: 'id',
    type: 'string',
    before: function(id) {return id.split(' ');}
  }], function(err, result) {
    if (err) throw err;
    var fetched = false, getAcOutputAfter = false, overwriteAfter = false, extensionSet = false;  // flag for unfinished problems
    var rawId = result.id, countValidId = 0;
    var idArray = new Array();
      // simply press Enter => fetch unfinished problems
    // if (rawId.length == 1 && rawId[0] == '') {

    // }
    for (i in rawId) {
      var oneId = rawId[i];
      if (!extensionSet && oneId.match(/^\!\..{1,}\!$/)) {
        extensionSet = true, submissionOutputExtension = oneId.slice(1, -1);
      // } else if (!fetched && oneId.match(/^u$/)) {
      } else if (oneId.match(/^[Mm]$/)) {
        cancelMemoryCheck = true;
      } else if (oneId.match(/^[Cc]$/)) {
        getAcOutputAfter = true;
      } else if (oneId.match(/^[Ww]$/)) {
        overwriteAfter = true;
      } else if (oneId.match(/^((\d){1,})[CcWw]{0,5}$/) && !oneId.match(/([CcWw])(?=.*\1)/)) {
        ++countValidId;
        var getAc = false, overwrite = false;
        if (~oneId.indexOf('c') || ~oneId.indexOf('C')) getAc = true;
        if (~oneId.indexOf('w') || ~oneId.indexOf('W')) overwrite = true;
        FetchOne(oneId.replace(/[CcWw]/g, ''), false, getAcOutputAfter || getAc, overwriteAfter || overwrite);
      } else if (oneId != '') {  // else => ignore
        if (chinese) console.log('忽略非法id "' + oneId + '"');
        else console.log('invalid id "' + oneId + '" ignored');
      }
    }
      // no valid id input
    if (countValidId == 0 && !fetched) {
      if (chinese) console.log('无效输入！请重试...');
      else console.log('Bad input! Please try again...');
      getAssignmentsId();
    }
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
    if (chinese) console.log('用户', body.data.nickname, '登录成功 (用户名: ' + username + ')');
    else console.log('Logged in as ' + body.data.nickname + ' (username: ' + username + ')');
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
            if (err) return getAssignmentsId();
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
  if (err) return informConnectionFailed(err);
  new UsersDataManager(usersdataFilename, function(err, self) {
    if (err) return;
    else return usersDataManager = self, welcome();
  });
});
