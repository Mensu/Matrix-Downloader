var config = require('../../config.js');
function removeUbuntuQuotationMarks(str, quotation) {
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

function filenamesInputParser(raw) {
  var raw = raw.split(' ');
  var result = [];
  var skip = 0;
  for (var i = 0; i != raw.length; ++i) {
    var index = i;
    if (skip) {
      --skip;
      continue;
    }
    var oneFilename = raw[index], length = oneFilename.length;

      // sanitize filenames. Badly needs improvement
    if (~config.os.indexOf('win')) {
      while (oneFilename[0] == '"' && (oneFilename[length - 1] != '"' || length == 1)) {
        /** if the filename begins with but not ends with a quotation mark ["]
          * it's not complete,
          * like ["my output.txt"] being split into two parts: ["my] and [output.txt"]
          * we should concatenate them.
          * we have got ["my], and we should get the other part [output.txt"] now.
          * obviously, raw[index + 1] is the other part [output.txt"],
          * and we can now concatenate ["my] + [ ] + [output.txt"],
          *                           oneFilename  ' '  raw[index + 1]
          *                                   --- with oneFilename += (' ' + raw[index + index]);
          * therefore we got ["my output.txt"]
          * use "skip" to skip the ordinary loop that would have fetched us [output.txt"]
          */
        ++skip;
        if (index + 1 == raw.length) break;  // or rawFile[index + 1] would be undefined
        else oneFilename += (' ' + raw[++index]);
        length = oneFilename.length;
      }
    } else if (config.os == 'mac') {
        /** if the filename doesn't begin with ["] or [']
          * but ends with \
          * it's not complete,
          * like [my\ output.txt] being split into two parts: [my\] and [output.txt]
          * we should concatenate them and remove the [\] which is used to mark white spaces
          * we have got [my\], and we should get the other part [output.txt] now.
          * obviously, raw[index + 1] is the other part [output.txt"],
          * and we can now concatenate [my]         +         [ ] + [output.txt]
          *                   oneFilename[0]~oneFilename[length - 2]  ' '  raw[index + 1]
          *                          --- with oneFilename = (oneFilename.substring(0, length - 1) + ' ' + raw[index + 1]);
          * therefore we got [my output.txt]
          * use "skip" to skip the ordinary loop that would have fetched us [output.txt]
          */
      if (oneFilename[0] != '"' && oneFilename[0] != "'") {
        while (oneFilename[length - 1] == '\\') {
          ++skip;
          if (index + 1 == raw.length) break;  // or rawFile[index + 1] would be undefined
          oneFilename = (oneFilename.slice(0, -1) + ' ' + raw[++index]);
          length = oneFilename.length;
        }
      } else {
          /** if the filename begins with ["] but not ends with ["]
            * or the filename begins with ['] but not ends with [']
            * it's not complete
            * the algorithm is the same as the one for windows above
            */
        while ((oneFilename[0] == '"' && (oneFilename[length - 1] != '"' || length == 1))
          || (oneFilename[0] == "'" && (oneFilename[length - 1] != "'" || length == 1))) {
          ++skip;
          if (index + 1 == raw.length) break;
          else oneFilename += (' ' + raw[++index]);
          length = oneFilename.length;
        }
      }
    } else if (config.os == 'ubuntu') {
        // almost the same as on Mac
        // except for the absence of the removal of [\]
        // and dealing with patterns at the end of the split filename like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
          // 
      if (oneFilename[0] != '"' && oneFilename[0] != "'") {
        while (oneFilename[length - 1] == '\\') {
          ++skip;
          if (index + 1 == raw.length) break;  // or rawFile[index + 1] would be undefined
          oneFilename = (oneFilename.slice(0, -1) + '\\ ' + raw[++index]);
          length = oneFilename.length;
        }
      } else {
        while ((oneFilename[0] == '"' && (oneFilename[length - 1] != '"' || length == 1 || oneFilename.match(/((\"\\.\")|(\'\\.\'))$/)))
          || (oneFilename[0] == "'" && (oneFilename[length - 1] != "'" || length == 1 || oneFilename.match(/((\"\\.\")|(\'\\.\'))$/)))) {
            ++skip;
            if (index + 1 == raw.length) break;
            else oneFilename += (' ' + raw[++index]);
          length = oneFilename.length;
        }
      }
    }

    if ((oneFilename[0] == "'" || oneFilename[0] == '"') && oneFilename[0] == oneFilename[length - 1]) {
      // if the filename begins and ends with quotation marks ['] or ["]
        // => remove them, as well as extra white spaces at the beginning and the end
      oneFilename = oneFilename.slice(1, -1).replace(/(^( *))|(( *)$)/g, '');

        // if it's on Ubuntu
          // deal with patterns like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
      if (ubuntu) oneFilename = removeUbuntuQuotationMarks(oneFilename, true);
    } else {
        // if it's on Mac and the filename doesn't begins or ends with ['] or ["]
          // remove unnecessary [\]
      if (config.os == 'mac') oneFilename = oneFilename.replace(/\\\\/g, '\t').replace(/\\/g, '').replace(/\t/g, '\\');
        // if it's on Ubuntu
          // remove unnecessary [\] and deal with patterns like ['\''] (=>[']), ['\ '] (=>[ ]), ["\""] (=>["])
      else if (config.os == 'ubuntu') oneFilename = removeUbuntuQuotationMarks(oneFilename, false);
    }
    // filename sanitization ends
    if (oneFilename == '') continue;
    else result.push(oneFilename);
  }
  return result;
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
    exports['filenamesInputParser'] = factory();
  else
    root['filenamesInputParser'] = factory();
})(this, function factory() {
  return filenamesInputParser;
});
