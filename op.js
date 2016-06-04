var windows = false;
var mac = false;
var ubuntu = false;

var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var prompt = require('prompt');
var getDirName = path.dirname;
var sprintf = require('sprintf-js').sprintf;

function readDataFrom(filename, callback) {
  fs.stat(filename, function(err, stat) {
    if (err) {
      if (callback) console.log('', err.message), callback(err, filename);
      else throw err;
    } else {
      fs.readFile(filename, 'utf-8', function(err, rawData) {
        if (err) {
          if (callback) console.log('', err.message), callback(err);
          else throw err;
        } else if (callback) callback(null, filename, rawData.replace(/\r\n/g, '\n'));
      });
    }
  });
};


function writeFile(path, contents, callback) {
  mkdirp(getDirName(path), function(err) {
    if (err) {
      if (callback) console.log('', err.message), callback(err);
      else throw err;
    }
    if (windows) contents = contents.replace(/\n/g, '\r\n');
    fs.writeFile(path, contents, function(err) {
      if (err) {
        if (callback) console.log('', err.message), callback(err);
        else throw err;
      } else if (callback) callback();
    });
  });
}

      // "Quotation Marks" here refers to patterns like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
function removeUbuntuFilenameQuotationMarks(str, quotation) {
  var newStr = '';
  for (var i = 0; i < str.length;) {
    if (str[i] != '"' && str[i] != "'") {
      if (!quotation && str[i] == '\\') ++i;
      newStr = newStr.concat(str[i++]);
    } else {
      if (str.substring(i, i + 4).match(/(\"\\.\")|(\'\\.\')/)) {
        ++i;
        if (!quotation) newStr = newStr.concat(str[i]);
        newStr = newStr.concat(str[++i]);
        i += 2;
      } else newStr = newStr.concat(str[i++]);
    }
  }
  return newStr;
}

function addLinenum(str) {
  if (str == 'unavailable' || str.length == 0) return str;
  var length = str.length, result = '', endWithoutNewLine = true;
  if (str[length - 1] == '\n') endWithoutNewLine = false;
  str = str.split('\n');
  for (i in str) result += sprintf('%03d |', parseInt(i) + 1) + str[i] + '\n';
  length = result.length;
  return result.substring(0, length - endWithoutNewLine);
}

function generateOutput(rawData, callback) {
  rawData = rawData.substring(rawData.indexOf('['), rawData.length).replace(/((\s*)$)/g, '').replace(/…$/, '');
  if (!rawData.match(/(\}\]$)/)) rawData += '...(possibly missing data expected)"}]';
  try {
    rawData = JSON.parse(rawData);
  } catch (e) {
    var index = rawData.lastIndexOf('","');
    if (~index) {
      try {
        rawData = JSON.parse(rawData.substring(0, index) + '...(possibly missing data expected)"}]');
      } catch (e) {
        console.log('', e.name + ": " + e.message);
        console.log('Error: Failed to parse the json. You might want to try deleting some characters at the end of the file.');
        console.log('*** Note: For the moment the polisher can only deal with the abnormal case where data are incomplete after a string-type value, such as [{"key":"incomplete valu\n');
        if (callback) return callback(e, null);
      }
    } else {
      console.log('', e.name + ": " + e.message);
      console.log('Error: Failed to parse the json. You might want to try deleting some characters at the end of the file.');
      console.log('*** Note: For the moment the polisher can only deal with the abnormal case where data are incomplete after a string-type value, such as [{"key":"incomplete valu\n');
      if (callback) return callback(e, null);
    }
  }
  var result = '';
  var wrap = function(str, unit) { return ((typeof(str) != 'undefined') ? (str + ((unit) ? unit : '')) : 'unavailable'); },
    wrapBorder = function(str) {
      var border = '-----------------------------------\n';
      if (!str.match(/\n$/)) {
        if (str == 'unavailable' || str.match(/\.\.\.\(possibly missing data expected\)$/)) str += '\n';
        else str += "\n(Not end with a '\\n')\n";
      }
      return border + str + border;
    };
  for (i in rawData) {
    var test = rawData[i];
    result += '\n============ Test ' + i + ' ===============\n';
    result += 'Result code: ' + wrap(test.result) + '\n';
    result += 'Memory used: ' + wrap(test.memoryused, 'KB') + ', Time used: ' + wrap(test.timeused, 'ms') + '\n\n';
    result += 'Test input:\n' + wrapBorder(wrap(test.stdin, '\n')) + '\n';
    if (test.result != 'CR') result += 'Standard answer:\n' + wrapBorder(addLinenum(wrap(test.standard_stdout))) + '\n';
    result += 'Your answer:\n' + wrapBorder(addLinenum(wrap(test.stdout))) + '\n';
  }
  if (callback) callback(null, result);
}

function start() {
  prompt.start();
  console.log('Please input the filenames (supports multiple filenames separated by spaces)');
  console.log('or [simply press Enter] to polish ./output.txt');
  console.log('  *** WARNING: The original file will get OVERWRITTEN! It is wise to backup in advance.');
  console.log('  *** Note: We only accept .txt files encoded in UTF-8.');
  console.log('  *** Note: It is suggested that you drag the file onto the terminal.');
  if (windows) {
    console.log('  *** Note: If the filename contains white spaces like my output.txt, please bother to use double quotation marks ["]');
    console.log('  *** my output.txt => "my output.txt"');
  } else {
    console.log('  *** Note: If the filename contains white spaces like "my output.txt", please bother to add "\\" before white spaces');
    console.log('  *** my output.txt => my\\ output.txt');
  }

  prompt.get([{
    name: 'files',
    type: 'string',
    description: 'files',
    before: function(files) {return files.split(' ');}
  }], function(err, result) {
    if (err) throw err;
    var rawFiles = result.files, countForValidFilename = 0, skip = 0;
      // simply press Enter => polish "./output.txt"
    console.log('');
    if (rawFiles.length == 1 && rawFiles[0] == '') {
      console.log('Ready to polish "./output.txt"');
      return readDataFrom("./output.txt", function(err, filename, rawData) {
        if (err) {
          if (err.code === "ENOENT") console.log('   ... Failed to polish "./output.txt". Please get the file ready and try again...');
          start();
        } else {
          generateOutput(rawData, function(err, result) {
            if (err) console.log('   ... Failed to polish "' + filename + '"');
            else writeFile(filename, result, function(err) {
                if (err) console.log('   ... Failed to polish "' + filename + '"');
                else console.log('   ..."' + filename + '" was polished successfully!');
              });
          });
        }
      });
    }
    var numOfRawFiles = rawFiles.length;
    for (i in rawFiles) {
      if (skip) {
        --skip;
        continue;
      }
      var oneFile = rawFiles[i], length = oneFile.length;

        // sanitize filenames. Badly needs improvement
      if (windows) {
        while (oneFile[0] == '"' && (oneFile[length - 1] != '"' || length == 1)) {
          /** if the filename begins with but not ends with a quotation mark ["]
            * it's not complete,
            * like ["my output.txt"] being split into two parts: ["my] and [output.txt"]
            * we should concatenate them.
            * we have got ["my], and we should get the other part [output.txt"] now.
            * obviously, rawFiles[i + 1] is the other part [output.txt"],
            * and we can now concatenate ["my] + [ ] + [output.txt"],
            *                           oneFile  ' '  rawFiles[i + 1]
            *                                   --- with oneFile += (' ' + rawFiles[i + i]);
            * therefore we got ["my output.txt"]
            * use "skip" to skip the ordinary loop that would have fetched us [output.txt"]
            */
          ++skip;
          if (i + 1 == numOfRawFiles) break;  // or rawFile[i + 1] would be undefined
          else oneFile += (' ' + rawFiles[++i]);
          length = oneFile.length;
        }
      } else if (mac) {
          /** if the filename doesn't begin with ["] or [']
            * but ends with \
            * it's not complete,
            * like [my\ output.txt] being split into two parts: [my\] and [output.txt]
            * we should concatenate them and remove the [\] which is used to mark white spaces
            * we have got [my\], and we should get the other part [output.txt] now.
            * obviously, rawFiles[i + 1] is the other part [output.txt"],
            * and we can now concatenate [my]         +         [ ] + [output.txt]
            *                   oneFile[0]~oneFile[length - 2]  ' '  rawFiles[i + 1]
            *                          --- with oneFile = (oneFile.substring(0, length - 1) + ' ' + rawFiles[i + 1]);
            * therefore we got [my output.txt]
            * use "skip" to skip the ordinary loop that would have fetched us [output.txt]
            */
        if (oneFile[0] != '"' && oneFile[0] != "'") {
          while (oneFile[length - 1] == '\\') {
            ++skip;
            if (i + 1 == numOfRawFiles) break;  // or rawFile[i + 1] would be undefined
            oneFile = (oneFile.substring(0, length - 1) + ' ' + rawFiles[++i]);
            length = oneFile.length;
          }
        } else {
            /** if the filename begins with ["] but not ends with ["]
              * or the filename begins with ['] but not ends with [']
              * it's not complete
              * the algorithm is the same as the one for windows above
              */
          while ((oneFile[0] == '"' && (oneFile[length - 1] != '"' || length == 1))
            || (oneFile[0] == "'" && (oneFile[length - 1] != "'" || length == 1))) {
            ++skip;
            if (i + 1 == numOfRawFiles) break;
            else oneFile += (' ' + rawFiles[++i]);
            length = oneFile.length;
          }
        }
      } else if (ubuntu) {
          // almost the same as on Mac
          // except for the absence of the removal of [\]
          // and dealing with patterns at the end of the split filename like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
            // 
        if (oneFile[0] != '"' && oneFile[0] != "'") {
          while (oneFile[length - 1] == '\\') {
            ++skip;
            if (i + 1 == numOfRawFiles) break;  // or rawFile[i + 1] would be undefined
            oneFile = (oneFile.substring(0, length - 1) + '\\ ' + rawFiles[++i]);
            length = oneFile.length;
          }
        } else {
          while ((oneFile[0] == '"' && (oneFile[length - 1] != '"' || length == 1 || oneFile.match(/((\"\\.\")|(\'\\.\'))$/)))
            || (oneFile[0] == "'" && (oneFile[length - 1] != "'" || length == 1 || oneFile.match(/((\"\\.\")|(\'\\.\'))$/)))) {
              ++skip;
              if (i + 1 == numOfRawFiles) break;
              else oneFile += (' ' + rawFiles[++i]);
            length = oneFile.length;
          }
        }
      }

      if ((oneFile[0] == "'" || oneFile[0] == '"') && oneFile[0] == oneFile[length - 1]) {
        // if the filename begins and ends with quotation marks ['] or ["]
          // => remove them, as well as extra white spaces at the beginning and the end
        oneFile = oneFile.substring(1, length - 1).replace(/(^( *))|(( *)$)/g, '');

          // if it's on Ubuntu
            // deal with patterns like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
        if (ubuntu) oneFile = removeUbuntuFilenameQuotationMarks(oneFile, true);
      } else {
          // if it's on Mac and the filename doesn't begins or ends with ['] or ["]
            // remove unnecessary [\]
        if (mac) oneFile = oneFile.replace(/\\\\/g, '\t').replace(/\\/g, '').replace(/\t/g, '\\');
          // if it's on Ubuntu
            // remove unnecessary [\] and deal with patterns like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
        else if (ubuntu) oneFile = removeUbuntuFilenameQuotationMarks(oneFile, false);
      }
      // filename sanitization ends


      if (oneFile.match(/(.txt)$/)) {
          // filename is valid => polish it
        ++countForValidFilename;
        console.log('Ready to polish "' + oneFile + '"');
        readDataFrom(oneFile, function(err, filename, rawData) {
          if (err) {
            if (err.code === "ENOENT") console.log('   ... Failed to polish "' + filename + '". Please get the file ready and try again...');
          } else {
            generateOutput(rawData, function(err, result) {
              if (err) console.log('   ... Failed to polish "' + filename + '"');
              else writeFile(filename, result, function(err) {
                  if (err) console.log('   ... Failed to polish "' + filename + '"');
                  else console.log('   ..."' + filename + '" was polished successfully!');
                });
            });
          }
        });
      } else if (oneFile != '') {  // else => ignore
        console.log('invalid filename "' + oneFile + '" ignored');
      }
    }
      // no valid filename input
    if (countForValidFilename == 0) {
      console.log('Bad input! Please try again...');
      return start();
    }
  });
}


console.log('Welcome!');
start();



