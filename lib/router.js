var vPath = require('path');

function Router(config) {
    this.processRoute = function(req, res) {
        var root = __dirname.replace(vPath.normalize('/node_modules/extdirect/lib'), ''),
            data = req.body,
            callback,
            currentPacket,
            upload = false,
            d = [],
            reduce,
            rLen,
            clonedPacket,
            batch = [],
            api,
            i;

        //process after we return from DX method
        var finalCallback = function(batch) {
            var str = JSON.stringify(batch, 'utf8');
            if(reduce === 0) {
                if (upload) {
                    res.writeHead(200, {'Content-type': 'text/html'});
                    res.end('<html><body><textarea>' + str + '</textarea></body></html>');
                } else {
                    res.writeHead(200, {'Content-type': 'application/json'});
                    res.end(str);
                }
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

                delete clonedPacket.extAction;
                delete clonedPacket.extType;
                delete clonedPacket.extMethod;
                delete clonedPacket.extTID;
                delete clonedPacket.extUpload;
            }

            callback = function(packet) {
                return function(result, event, error) {
                    var newPacket;
                    if(event && event === 'exception') {
                        newPacket = {
                            type: 'exception',
                            tid: packet.tid,
                            action: packet.action,
                            method: packet.method,
                            message: '',
                            data: null
                        };

                        if(process.env.NODE_ENV !== 'production') {
                            newPacket.message = error.message;
                            newPacket.data = error;
                        }
                    } else {
                        newPacket = {
                            type: event ? 'event' : 'rpc',
                            tid: packet.tid,
                            action: packet.action,
                            method: packet.method,
                            result: result
                        };

                        if(event) {
                            newPacket.data = event;
                        }
                    }
                    batch.push(newPacket);
                    reduce--;
                    finalCallback(batch);
                }
            }.apply(null, [currentPacket]);

            api = require(vPath.join(root, config.classPath, currentPacket.action));

            if(!currentPacket.data) {
                currentPacket.data = [];
            }
            if(clonedPacket) {
                currentPacket.data.push(clonedPacket);
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
                finalCallback(batch);
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
