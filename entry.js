var UI = require('./components/UI.js');
try {
  UI.start().catch(function(errs) {
    UI.printErrs(errs);
  });
} catch (e) {
  console.log('err:', e);
}
