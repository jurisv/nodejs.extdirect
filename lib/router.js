var vPath = require('path'),
    platform = require('os').platform();

function Router(config) {
    this.processRoute = function(req, res){
        var me = this;

        if(config.enableProcessors) {

            var root = __dirname.replace(vPath.normalize('/node_modules/extdirect/lib'), ''),
                fileName = vPath.join(root, config.classPath, '.scripts', 'RouterProcessor.js'),
                processor = require(fileName);

            if (!config.cacheAPI) {
                //invalidate node module cache
                delete require.cache[fileName];
            }

            processor.beforeTransaction(req, res, function(err){
                if(err){

                } else {
                    me.runTransaction(req, res);
                }
            });
        } else {
            me.runTransaction(req, res);
        }
    };

    this.afterTransaction = function(req, res, upload, batch){
        var str;

        if(config.enableProcessors) {

            var root = __dirname.replace(vPath.normalize('/node_modules/extdirect/lib'), ''),
                fileName = vPath.join(root, config.classPath, '.scripts', 'RouterProcessor.js'),
                processor = require(fileName);

            if (!config.cacheAPI) {
                //invalidate node module cache
                delete require.cache[fileName];
            }

            processor.afterTransaction(req, res, batch, function(err, batch){
                if(err){

                } else {
                    str = JSON.stringify(batch, 'utf8');
                    if (upload) {
                        res.writeHead(200, {'Content-type': 'text/html'});
                        res.end('<html><body><textarea>' + str + '</textarea></body></html>');
                    } else {
                        res.writeHead(200, {'Content-type': 'application/json'});
                        res.end(str);
                    }
                }
            });
        } else {
            str = JSON.stringify(batch, 'utf8');
            if (upload) {
                res.writeHead(200, {'Content-type': 'text/html'});
                res.end('<html><body><textarea>' + str + '</textarea></body></html>');
            } else {
                res.writeHead(200, {'Content-type': 'application/json'});
                res.end(str);
            }
        }
    };


    this.runTransaction = function(req, res) {
        var me = this,
            root = __dirname.replace(vPath.normalize('/node_modules/extdirect/lib'), ''),
            data = req.body,
            slash = platform.substr(0,3) === 'win' ? '\\' : '/', //untested
            callback,
            currentPacket,
            upload = false,
            d = [],
            reduce,
            rLen,
            clonedPacket,
            batch = [],
            api,
            apiPath,
            i;

        // Finish up
        var finalCallback = function(err, batch) {
            if(reduce === 0) {
                me.afterTransaction(req, res, upload, batch);
            }
        };

        if(data instanceof Array) {
            d = data;
        } else {
            d.push(data);
        }

        reduce = d.length;

        for(i = 0, rLen = d.length; i < rLen; i++) {
            currentPacket = d[i];

            if (currentPacket.extAction) {
                clonedPacket = this.copyObject(currentPacket);
                currentPacket.action = currentPacket.extAction;
                currentPacket.method = currentPacket.extMethod;
                currentPacket.tid = currentPacket.extTID;
                currentPacket.type = currentPacket.extType;
                currentPacket.isUpload = upload = currentPacket.extUpload === 'true';

                clonedPacket.extAction = null;
                clonedPacket.extType = null;
                clonedPacket.extMethod = null;
                clonedPacket.extTID = null;
                clonedPacket.extUpload = null;

            }

            callback = function(packet) {

                return function(error, result) {
                    var newPacket;
                    result = result !== undefined ? result : {};

                    if(error) {
                        newPacket = {
                            type: 'exception',
                            tid: packet.tid,
                            action: packet.action,
                            method: packet.method,
                            message: 'Exception',
                            data: null
                        };

                        if(process.env.NODE_ENV !== 'production') {
                            newPacket.message = error.message ? error.message : 'Exception';
                            newPacket.data = error;
                        }
                    } else {
                        newPacket = {
                            type: result.event ? 'event' : 'rpc',
                            tid: packet.tid,
                            action: packet.action,
                            method: packet.method,
                            result: result
                        };

                        if(result.event) {
                            newPacket.data = event;
                        }

                        if(config.responseHelper){
                            //We set success to true if responseHelper is TRUE and callback is called without any arguments or with true as result or result object is present, but success is missing
                            if(!result || result === true) {
                                newPacket.result.success = true;
                            }

                            //Result is there, but success property is not mentioned. Let's fix it
                            if(result && (result.success === undefined || result.success === null)) {
                                newPacket.result.success = true;
                            }

                            //We set success to false if autoResponse is TRUE and callback is called with result set to false
                            if(result && result === false) {
                                newPacket.result.success = false;
                            }
                        }
                    }

                    batch.push(newPacket);
                    reduce--;
                    finalCallback(null, batch);
                }
            }.apply(null, [currentPacket]);

            apiPath = vPath.join(root, config.classPath, currentPacket.action.replace('.', slash)) + '.js';
            api = require(apiPath);

            if(!config.cacheAPI){
                //invalidate node module cache
                delete require.cache[apiPath];
            }

            if(!currentPacket.data) {
                currentPacket.data = [];
            }

            if(clonedPacket) {
                currentPacket.data.push(clonedPacket);
            }

            //mix in metadata
            if(currentPacket.metadata) {
                currentPacket.data[0].metadata = currentPacket.metadata;
            }

            // 2nd parameter callback
            currentPacket.data.push(callback);

            // keep backwards capability on sessions as 3rd parameter
            currentPacket.data.push(req.sessionID ? req.sessionID : null);

            // add 4th hand 5th parameter - request object, configurable
            if(config.appendRequestResponseObjects) {
                currentPacket.data.push(req);
                currentPacket.data.push(res);
            }

            if(config.logging) {
                config.logging(currentPacket.action, currentPacket.method, clonedPacket);
            }

            try {
                api[currentPacket.method].apply({}, currentPacket.data);
            } catch(e) {
                if(process.env.NODE_ENV !== 'production') {
                    batch.push({
                        type: 'exception',
                        tid: currentPacket.tid,
                        action: currentPacket.action,
                        method: currentPacket.method,
                        message: e.message,
                        data: e
                    });
                } else {
                    batch.push({
                        type: 'rpc',
                        tid: currentPacket.tid,
                        action: currentPacket.action,
                        method: currentPacket.method,
                        data: null
                    });
                }
                reduce--;
                finalCallback(null, batch);
            }
        }
    };

    this.copyObject = function(obj) {
        var newObj = {};
        for (var key in obj) {
            newObj[key] = obj[key];
        }
        return newObj;
    }
}

module.exports = Router;
