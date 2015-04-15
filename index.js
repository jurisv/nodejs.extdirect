var api = require('./lib/api'),
    router = require('./lib/router'),
    extdirect = module.exports;

extdirect.initApi = function(config){
    return new api(config);
};

extdirect.initRouter = function(config){
    return new router(config);
};
