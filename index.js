var api    = require('./lib/api'),
    router = require('./lib/router'),
    extdirect = module.exports;

extdirect.getAPI = api.getAPI;
extdirect.processRoute = router.processRoute;