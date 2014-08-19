var fs = require('fs'),
    vPath = require('path');

var api = {
    getAPI: function(config){
        if(global[config.apiName]){
            return global[config.apiName];
        }else{
            return api.createCachedAPI(config);
        }
    },

    createCachedAPI: function(config){
        var root = __dirname.replace(vPath.normalize('/node_modules/extdirect/lib'),''),
            dxPath = vPath.join(root, config.classPath),
            files = fs.readdirSync(dxPath),
            front = 'Ext.ns("' + config.namespace +'");' + config.namespace + '.' + config.apiName + '=',
            res  = {
                "url": config.relativeUrl ? config.classPath : config.protocol + '://' + config.server + (config.port == '80' ? '' : (':'+ config.port))+  config.classPath,
                "namespace" : config.namespace,
                "type": "remoting",
                "actions": {},
                "timeout": config.timeout
            },
            actionName,
            i = 0,
            len = files.length,
            ref,
            a,
            o,
            x;

        for(; i < len; i++){
            actionName = vPath.basename(files[i], '.js');
            if(config.classPrefix && actionName.substr(0, config.classPrefix.length) === config.classPrefix){
                x = require(vPath.join(dxPath, files[i]));
                res.actions[actionName] = [];
                for(a in x){
                    ref = api.reflection(x[a]);
                    if(ref){
                        o = {
                            name: a,
                            len: 1 // We tell client side that we accept 1 parameter, 2nd parameter is callback, where 3rd is options containing various objects
                        };
                        if(ref.formHandler){
                            o.formHandler = true;
                        }

                        res.actions[actionName].push(o);
                    }
                }
                delete (x);
            }
        }
        //cache globally
        global[config.apiName] = front + JSON.stringify(res, 'utf8');

        return global[config.apiName];
    },

    reflection: function(fn){
        if (typeof fn == 'function') {
            var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m,
                FN_ARG_SPLIT = /,/,
                FN_ARG = /^\s*(_?)(.+?)\1\s*$/,
                STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg,
                FORM_HANDLER = /\/\* *formHandler *\*\//,
                args = [],
                fnStr = fn.toString(),
                formHandler = FORM_HANDLER.test(fnStr),
                fnText,
                argDecl,
                arg,
                a;

            fnText = fnStr.replace(STRIP_COMMENTS, '');
            argDecl = fnText.match(FN_ARGS);

            var r = argDecl[1].split(FN_ARG_SPLIT);
            for(a in r){
                arg = r[a];
                arg.replace(FN_ARG, function(all, underscore, name){
                    args.push(name);
                });
            }
            return {
                args:args,
                formHandler:formHandler
            };
        }else{
            return null;
        }
    }
};

module.exports = api;
