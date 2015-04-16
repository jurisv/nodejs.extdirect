var fs = require('fs'),
    vPath = require('path');

function API(config) {
    this.getAPI = function(callback) {
        if(config.cacheAPI && global[config.apiName]) {
            callback(global[config.apiName]);
        } else {
            this.createCachedAPI(callback);
        }
    };

    this.createCachedAPI = function(callback) {
        var me = this,
            root = __dirname.replace(vPath.normalize('/node_modules/extdirect/lib'), ''),
            dxPath = vPath.join(root, config.classPath),
            dxLen = dxPath.length,
            responseNamespace = 'Ext.ns("' +
                config.rootNamespace + '");' +
                config.rootNamespace + '.' +
                config.apiName +
                '=',
            response = {
                'url': config.relativeUrl ? config.classPath : config.protocol + '://' + config.server + (config.port == '80' ? '' : (':' + config.port)) + config.classPath,
                'namespace': config.rootNamespace,
                'type': 'remoting',
                'actions': {},
                'timeout': config.timeout || 30000
            };

        me.walk(dxPath, function(err, arr) {
            if (err) throw err;

            var actionName,
                i = 0,
                len = arr.length,
                filePath,
                reflection,
                methodName,
                actionDescription,
                apiFile;

            //Now we have all Class files with their namespaces
            //Let's build API

            for(; i < len; i++) {
                filePath = arr[i];
                //remove dxPath from item
                actionName = filePath.substring(dxLen + 1, filePath.length - 3).replace(/[\/\\]/g, '.');

                apiFile = require(filePath);
                response.actions[actionName] = [];

                //TODO: Refacor
                for (methodName in apiFile) {
                    reflection = me.reflection(apiFile[methodName]);
                    if (reflection) {
                        actionDescription = {
                            name: methodName,
                            len: 1 // We tell client side that we accept 1 parameter, 2nd parameter is callback, where 3rd is options containing various objects
                        };

                        if (reflection.formHandler) {
                            actionDescription.formHandler = true;
                        }

                        if (reflection.meta) {
                            actionDescription.metadata = {
                                params: reflection.meta
                            };
                        }

                        if (reflection.params) {
                            actionDescription.params = {
                                params: reflection.params
                            };
                        }

                        response.actions[actionName].push(actionDescription);
                    }
                }

                if(!response.actions[actionName].length){
                    response.actions[actionName] = null;
                }

                apiFile = null;

            }

            //cache globally
            global[config.apiName] = responseNamespace + JSON.stringify(response, 'utf8');

            callback(global[config.apiName]);
        });

    };

    this.reflection = function(fn) {
        if (typeof fn === 'function') {
            var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m,
                FN_ARG_SPLIT = /,/,
                FN_ARG = /^\s*(_?)(.+?)\1\s*$/,
                STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg,
                METADATA_REGEX = /(\/\/@meta.*)/gi,
                PARAMS_REGEX = /(\/\/@params.*)/gi,
                FORM_HANDLER_REGEX = /(\/\/@formHandler.*)/gi,
                args = [],
                fnStr = fn.toString(),
                formHandler = fnStr.match(FORM_HANDLER_REGEX),
                fnText,
                argDecl,
                arg,
                metadata = fnStr.match(METADATA_REGEX),
                params = fnStr.match(PARAMS_REGEX),
                a;

            fnText = fnStr.replace(STRIP_COMMENTS, '');
            argDecl = fnText.match(FN_ARGS);

            var r = argDecl[1].split(FN_ARG_SPLIT);
            for(a in r) {
                arg = r[a];
                arg.replace(FN_ARG, function(all, underscore, name) {
                    args.push(name);
                });
            }

            return {
                args: args,
                formHandler: formHandler ? true : false,
                meta: metadata ? metadata[0].replace('meta', '').match(/\w+/gi) : false,
                params: params ? params[0].replace('params', '').match(/\w+/gi) : false
            };
        } else {
            return null;
        }
    };

    this.walk = function(path, callback) {
        var me = this,
            results = [];

        fs.readdir(path, function(err, list) {
            if (err) return callback(err);
            var i = 0;
            (function next() {
                var file = list[i++];
                if (!file) return callback(null, results);
                file = path + '/' + file; //TODO: Windows slash
                fs.stat(file, function(err, stat) {
                    if (stat && stat.isDirectory()) {
                        me.walk(file, function(err, res) {
                            results = results.concat(res);
                            next();
                        });
                    } else {
                        results.push(file);
                        next();
                    }
                });
            })();
        });
    };
}

module.exports = API;
