var vPath = require('path'),
    route = exports;

route.processRoute = function(req, resp, path){
    var root = process.env.PWD,
        files = req.files,
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
            cp = copyObject(so);
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
            return function(result, event){
                var packet = {
                    type: event ? 'event' : 'rpc',
                    tid: so.tid,
                    action: so.action,
                    method: so.method,
                    result: result
                };

                if(event){
                    packet.data = event;
                }

                batch.push(packet);
                reduce--;
                finalCallback(batch);
            }
        }.apply(null, [so]);

        x = require(vPath.join(root, path, so.action));

        if(!so.data){
            so.data = [];
        }
        if(cp){
            so.data.push(cp);
        }

        if(upload === true){
            so.data.push(files);
        }

        so.data.push(callback);

        if(req.sessionID){
            so.data.push(req.sessionID);
        }

        try{
            x[so.method].apply({} , so.data);
        }catch(e) {
            var packet = {
                type: 'exception',
                tid: so.tid,
                action: so.action,
                method: so.method,
                data: e.message
            };

            batch.push(packet);
            reduce--;
            finalCallback(batch);
        }
    }
};

function copyObject(obj) {
    var newObj = {};
    for (var key in obj) {
        newObj[key] = obj[key];
    }
    return newObj;
}