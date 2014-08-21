var vPath = require('path');

var route = {
    processRoute : function(req, resp, config){
        var root = __dirname.replace(vPath.normalize('/node_modules/extdirect/lib'),''),
            data = req.body,
            callback,
            so,
            upload = false,
            d = [],
            reduce,
            rLen,
            cp,
            batch = [],
            x,
            i;

        //process after we return from DX method
        var finalCallback = function(batch){
            var str = JSON.stringify(batch, 'utf8');
            if(reduce === 0){
                if (upload) {
                    resp.writeHead(200, {'Content-type': 'text/html'});
                    resp.end('<html><body><textarea>' + str + '</textarea></body></html>');
                } else {
                    resp.writeHead(200, {'Content-type': 'application/json'});
                    resp.end(str);
                }
            }
        };

        if(data instanceof Array){
            d = data;
        }else{
            d.push(data);
        }

        reduce = d.length;

        for(i = 0, rLen = d.length;  i < rLen; i++){
            so = d[i];

            if (so.extAction) {
                cp = route.copyObject(so);
                so.action = so.extAction;
                so.method = so.extMethod;
                so.tid = so.extTID;
                so.type = so.extType;
                so.isUpload = upload = so.extUpload === "true";

                delete cp.extAction;
                delete cp.extType;
                delete cp.extMethod;
                delete cp.extTID;
                delete cp.extUpload;
            }

            callback = function(so){
                return function(result, event, error){
                    var packet;
                    if(event && event === 'exception'){
                        packet = {
                            type: 'exception',
                            tid: so.tid,
                            action: so.action,
                            method: so.method,
                            message: '',
                            data: null
                        };

                        if(process.env.NODE_ENV !== 'production'){
                            packet.message = error.message;
                            packet.data = error;
                        }
                    }else{
                        packet = {
                            type: event ? 'event' : 'rpc',
                            tid: so.tid,
                            action: so.action,
                            method: so.method,
                            result: result
                        };

                        if(event){
                            packet.data = event;
                        }
                    }
                    batch.push(packet);
                    reduce--;
                    finalCallback(batch);
                }
            }.apply(null, [so]);

            x = require(vPath.join(root, config.classPath, so.action));

            if(!so.data){
                so.data = [];
            }
            if(cp){
                so.data.push(cp);
            }

            // 2nd parameter callback
            so.data.push(callback);

            // keep backwards capability on sessions as 3rd parameter
            so.data.push(req.sessionID ? req.sessionID : null);

            // add 4t hand 5th parameter - request object, configurable
            if(config.appendRequestResponseObjects){
                so.data.push(req);
                so.data.push(resp);
            }

            if(config.logging) {
                config.logging(so.action, so.method, cp);
            }

            try{
                x[so.method].apply({},so.data);
            }catch(e) {
                if(process.env.NODE_ENV !== 'production'){
                    batch.push({
                        type: 'exception',
                        tid: so.tid,
                        action: so.action,
                        method: so.method,
                        message: e.message,
                        data: e
                    });
                }else{
                    batch.push({
                        type:'rpc',
                        tid:so.tid,
                        action: so.action,
                        method: so.method,
                        data: null
                    });
                }
                reduce--;
                finalCallback(batch);
            }
        }
    },

    copyObject: function(obj) {
        var newObj = {};
        for (var key in obj) {
            newObj[key] = obj[key];
        }
        return newObj;
    }
};

module.exports = route;
