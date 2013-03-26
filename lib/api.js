var fs = require('fs'),
    vPath = require('path'),
    api = exports;

api.getAPI = function(namespace, apiName, path, prefix){
    if(global['EXT_REMOTING_API']){
        return EXT_REMOTING_API.api;
    }else{
        return createCachedAPI(namespace, apiName, path, prefix);
    }
};

function createCachedAPI(namespace, apiName, path, prefix){
    var root = process.env.PWD,
        api,
        dxPath = vPath.join(root, path),
        files = fs.readdirSync(dxPath),
        front = 'Ext.ns("' + namespace +'");' + namespace + '.' + apiName + '=',
        res  = {
            "url": path,
            "namespace" : namespace,
            "type": "remoting",
            "actions": {}
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
        if(prefix && actionName.substr(0, prefix.length) === prefix){
            x = require(vPath.join(dxPath, files[i]));
            res.actions[actionName] = [];
            for(a in x){
                ref = reflection(x[a]);
                if(ref){
                    o = {
                        name:a,
                        len:ref.args.length - 1 // Specify callback Fn as last argument
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
    global['EXT_REMOTING_API'] = {
        api : front + JSON.stringify(res, 'utf8')
    };
    return EXT_REMOTING_API.api;
}

function reflection(fn){
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