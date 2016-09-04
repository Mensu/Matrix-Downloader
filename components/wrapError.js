function wrapError(error, mcode, info) {
  if ( !(error instanceof Error) ) error = new Error(error);
  error['mcode'] = mcode;
  error['info'] = info;
  return error;
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
    exports['wrapError'] = factory();
  else
    root['wrapError'] = factory();
})(this, function factory() {
  return wrapError;
});
