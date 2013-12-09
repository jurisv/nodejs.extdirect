### Sencha Ext.Direct connector for node.js

#### Compatibility:
* Sencha Touch 2.3+
* ExtJs 4.2.x+

#### Server side implementation:

Step1: Create the folder where your node.js server will reside and then add the following file/folder structure:

```
/app.js
/config.json
/package.json
/public -> here you generate Sencha Touch/ ExtJs application using Sencha CMD
/direct -> here you will place all Ext.Direct files
/uploads -> file upload folder (must be writable by node.js)
```

Step 2: Edit app.js content to match example below:
Note: This example is using MySQL database
#### File app.js:

````
var express = require('express'),
    nconf = require('nconf'),
    http = require('http'),
    path = require('path'),
    mysql = require('mysql'),
    extdirect = require('extdirect');

nconf.env().file({ file: 'config.json'});

var ServerConfig = nconf.get("ServerConfig"),
    MySQLConfig = nconf.get("MySQLConfig"),
    ExtDirectConfig = nconf.get("ExtDirectConfig");

var app = express();

if(ServerConfig.enableSessions){
    //memory store for sessions - change to different storage here to match your implementation.
    var store  = new express.session.MemoryStore;
}

var mySQL = {
    connect : function(){
        var conn = mysql.createConnection({
            host: MySQLConfig.hostname,
            port: MySQLConfig.port,
            user: MySQLConfig.user,
            password: MySQLConfig.password,
            database: MySQLConfig.db
        });

        conn.connect(function(err) {
            if(err){
                console.error('Connection had errors: ', err.code);
                process.exit(1);
            }
        });

        return conn;
    },

    disconnect : function(conn){
        conn.end();
    }
};

// Make MySql connections available globally, so we can access them from within modules
global['mySQL'] =  mySQL;

app.configure(function(){

    app.set('port', process.env.PORT || ServerConfig.port);
    app.use(express.logger(ServerConfig.logger));

    if(ServerConfig.enableUpload){
        app.use(express.bodyParser({uploadDir:'./uploads'})); //take care of body parsing/multipart/files
    }

    app.use(express.methodOverride());

    if(ServerConfig.enableCompression){
        app.use(express.compress()); //Performance - we tell express to use Gzip compression
    }

    if(ServerConfig.enableSessions){
        //Required for session
        app.use(express.cookieParser());
        app.use(express.session({ secret: ServerConfig.sessionSecret, store: store }));
    }

    app.use(express.static(path.join(__dirname, ServerConfig.webRoot)));
});

//Important to get CORS headers and cross domain functionality
if(ServerConfig.enableCORS){
    app.all('*', function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    app.options(ExtDirectConfig.classPath, function(request, response) {
        response.writeHead(200, {'Allow': ServerConfig.allowedMethods});
        response.end();
    });
}

//GET method returns API
app.get(ExtDirectConfig.apiPath, function(request, response) {
    try{
        var api = extdirect.getAPI(ExtDirectConfig);
        response.writeHead(200, {'Content-Type': 'application/json'});
        response.end(api);
    }catch(e){
        console.log(e);
    }
});

// Ignoring any GET requests on class path
app.get(ExtDirectConfig.classPath, function(request, response) {
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({success:false, msg:'Unsupported method. Use POST instead.'}));
});

// POST request process route and calls class
app.post(ExtDirectConfig.classPath, function(request, response) {
    extdirect.processRoute(request, response, ExtDirectConfig);
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port %d in %s mode", app.get('port'), app.settings.env);
});

```
#### File package.json:
```
{
    "name": "touch-direct",
    "version": "1.0.0",
    "private": true,
    "scripts": {
        "start": "node app"
    },
    "repository": {
        "type": "git",
        "url": ""
    },
    "dependencies": {
        "express": "3.1.0",
        "nconf": "~0.6.7",
        "mysql": "~2.0.0",
        "extdirect":"~1.1.0"
    }
}
```
Step 3: Edit config.json file:

If you don't use Mysql or have any other database e.g. MongoDb, you can exclude config property related to database, but then be sure to take away all related code in app.js . It still might be a good idea to keep all Db config properties in this file.
<b>Important:</b> Since version 1.1.0 all properties are stored in this config file and there is no need to update app.js if you are using vanilla reference implementation.
Update config parameters that are relevant to your implementation.

#### File config.json
```
{
    "ServerConfig": {
        "port": 3000,
        "logger": "dev",
        "enableUpload": true,
        "enableCompression": true,
        "webRoot": "/public",
        "enableSessions": true,
        "sessionSecret": "vdW3F6y3506h",
        "enableCORS": true,
        "allowedMethods": "GET,POST,OPTIONS"
    },

    "MySQLConfig": {
        "hostname": "localhost",
        "port": 3306,
        "user": "script",
        "password": "JxJSNa3stRYSV68j",
        "db": "demo"
    },

    "ExtDirectConfig": {
        "namespace": "ExtRemote",
        "apiName": "REMOTING_API",
        "apiPath": "/directapi",
        "classPath": "/direct",
        "classPrefix": "DX",
        "server": "localhost",
        "port": "3000",
        "protocol": "http"
    }
}
```
Step 4: Create and modify your Sencah Touch / ExtJs application.

#### *** Touch application modifications ***

For you Sencha touch application you have to add the following lines inside Touch application main /public/app.js file, just before Ext.application code:
```
Ext.require([
    'Ext.direct.*'
]);

Ext.onReady(function(){
    Ext.direct.Manager.addProvider(ExtRemote.REMOTING_API); //Must match namespace and apiName defined in node.js server
});

//Ext.application({
//.. your app code here

```

/public/index.html(add the line for requesting API): 
```
<!-- The line below must be kept intact for Sencha Command to build your application -->
    <script id="microloader" type="text/javascript" src="touch/microloader/development.js"></script>
    <script type="text/javascript" src="/directapi"></script>
```

#### Method signature and structure of method

```
    // method signature has 5 parameters
    /**
     *
     * @param params object with received parameters
     * @param callback callback function to call at the end of current method
     * @param sessionID - current session ID if "enableSessions" set to true, otherwise null
     * @param request only if "appendRequestResponseObjects" enabled
     * @param response only if "appendRequestResponseObjects" enabled
     */
    authenticate: function(params, callback, sessionID, request, response){
        console.log(params)
        console.log(sessionID);
        console.log(request);
        console.log(response);

        /*
        You have full access to all request properties
        */
        console.log(request.session); //e.g. access session data

        /*
        You can directly modify your response payload, but be careful!
        */
        response.header('My-Custom-Header ', '1234567890');

        /*
        Business logic goes here
        */

        /*
        Call callback function at the end
        */
        callback({success:true});

        /*
        //or add some payload data
        callback({
            success:true,
            message:'Login successful',
            data:{
                name: 'Juris',
                surname: 'Vecvanags'
            }
        });
        */
    }

```


#### *** Sample direct methods ***
Create file /direct/DXTodoItem.js :
```
var table = 'todoitem';
var mysql = mySQL;

var DXTodoItem  = {
    create: function(params, callback){
        var conn = mysql.connect();
        delete params['id'];
        conn.query('INSERT INTO ' + table + ' SET ?', params, function(err, result) {
            mysql.disconnect(conn); //release connection
            if (err) throw err;

            conn.query('SELECT * FROM '  + table + ' WHERE id = ?', result.insertId, function(err, rows, fields) {
                callback(rows);
            });
        });
    },

    //callback as last argument is mandatory
    read: function(params, callback){
        var conn = mysql.connect();

        var sql = 'SELECT * from ' + table;
        // this sample implementation supports 1 sorter, to have more than one, you have to loop and alter query
        if(params.sort){
            var s = params.sort[0];
            sql = sql + ' order by ' + conn.escape(s.property) +  ' ' + conn.escape(s.direction);
        }

        // Paging
        sql = sql + ' limit ' + conn.escape(params.start) + ' , ' + conn.escape(params.limit);

        conn.query(sql, function(err, rows, fields) {
            if (err) throw err;

            //get totals for paging

            var totalQuery = 'SELECT count(*) as totals from ' + table;

            conn.query(totalQuery, function(err, rowsTotal, fields) {
                mysql.disconnect(conn); //release connection
                if (err) throw err;

                callback({
                    success: true,
                    data: rows,
                    total: rowsTotal[0].totals
                });
            });
        });
    },

    update: function(params, callback){
        var conn = mysql.connect();

        conn.query('UPDATE ' + table + ' SET ? where id = ' + conn.escape(params['id']), params, function(err, result) {
            mysql.disconnect(conn); //release connection
            if (err) throw err;
            callback({success:true});
        });
    },

    destroy: function(params, callback){
        var conn = mysql.connect();

        conn.query('DELETE FROM ' + table + ' WHERE id = ?', conn.escape(params['id']), function(err, rows, fields) {
            if (err) throw err;
            mysql.disconnect(conn); //release connection
            callback({success:true, id:params['id']});
        });
    }
};

module.exports = DXTodoItem;
```

#### *** Configure your application model with direct proxy  ***
```
Ext.define('TouchDirect.model.TodoItem', {
    extend: 'Ext.data.Model',
    config: {
        idProperty: 'id',
        fields: [{
            name: 'id',
            type: 'int'
        }, {
            name: 'text',
            type: 'string'
        }, {
            name: 'complete',
            type: 'boolean'
        }],

        proxy: {
            //Set proxy type
            type: 'direct',

            //Define action methods
            api: {
                create  : ExtRemote.DXTodoItem.create,
                read    : ExtRemote.DXTodoItem.read,
                update  : ExtRemote.DXTodoItem.update,
                destroy : ExtRemote.DXTodoItem.destroy
            }
        }
    }
});
```

####  *** ExtJS Application modifications ***

For your ExtJs app add in /public/app.js :
```
Ext.require([
    'Ext.direct.*'
]);

Ext.onReady(function(){
    Ext.direct.Manager.addProvider(ExtRemote.REMOTING_API);
});
```

#### Index file /public/index.html  add script containing directapi.
```
<!DOCTYPE HTML>
<html>
<head>
    <meta charset="UTF-8">
    <title>DesktopDirect</title>
    <!-- <x-compile> -->
        <!-- <x-bootstrap> -->
            <link rel="stylesheet" href="bootstrap.css">
            <script src="ext/ext-dev.js"></script>
            <script src="bootstrap.js"></script>
        <!-- </x-bootstrap> -->
        <script src="app.js"></script>
    <!-- </x-compile> -->
    <script src="/directapi"></script>
</head>
<body></body>
</html>
```

Then for your directCfg, and api definitions use string literals of methods,
like this:

#####Form:

```
api:{
      load: 'ExtRemote.DXFormTest.load',
      submit:'ExtRemote.DXFormTest.submit'
}
````

#####Grid store with directFn:

```
store: {
            model: 'Company',
            remoteSort: true,
            autoLoad: true,
            sorters: [{
                property: 'name',
                direction: 'ASC'
            }],
            proxy: {
                type: 'direct',
                directFn: 'TestAction.getGrid'
            }
        },
```
####Even more interesting is the file upload case:

#### ExtJs config
```
        {
                        xtype:'form',
                        title: 'File upload',
                        bodyPadding:5,
                        api:{
                            submit:'ExtRemote.DXFormTest.filesubmit'
                        },
                        paramOrder: ['uid'],
                        items:[
                            {
                                xtype:'textfield',
                                fieldLabel:'Description',
                                name:'description'
                            },
                            {
                                xtype: 'filefield',
                                name: 'photo',
                                fieldLabel: 'Photo',
                                labelWidth: 50,
                                msgTarget: 'side',
                                allowBlank: true,
                                anchor: '40%',
                                buttonText: 'Select Photo...'
                            }
                        ],
                        tbar:[
                            {
                                text:'Upload..',
                                handler:function(btn){
                                    btn.up('form').getForm().submit(
                                        {
                                            waitMsg: 'Uploading your photo...',
                                            success: function(fp, o) {
                                                Ext.Msg.alert('Success', 'Your photo "' + o.result.name +
                                                    '" has been uploaded.<br> File size:' + o.result.size + ' bytes.');
                                            }
                                        }
                                    );
                                }
                            }
                        ]
                    }
```

#### node.js sample for upload/submit/test/load

#### File:DXFormTest
```
var DXFormTest = {
    testMe: function(params, callback){
        callback({
            success:true,
            msg:'Hello world',
            params: params
        });
    },

    load: function(params, callback){
        callback({
            success:true,
            data:{
                firstname:'John',
                lastname: 'Smith',
                email: 'john.smith@comapny.info'
            }
        });
    },

    submit: function(params,  callback/*formHandler*/){
        callback({
            success:true,
            params:params
        });

    },
```

When dealing with forms that submit via submit api method or upload a file,
remember to mark your method with formHandler, as shown below
```
        filesubmit: function(params, callback, sessionID, request, response/*formHandler*/){
            var files = request.files; //get files from request object
            // console.log(params, files)

            // Do something with uploaded file, e.g. move to another location
            var fs = require('fs'),
                file = files.photo,
                tmp_path = file.path;

            // set where the file should actually exists - in this case it is in the "demo" directory
            var target_path = './public/demo/' + file.name;

            // move the file from the temporary location to the intended location
            // do it only if there is a file with size
            if(file.size > 0){
                try{
                    fs.rename(tmp_path, target_path, function(err) {
                        if(err){
                            callback({
                                success: false,
                                msg: 'Upload failed',
                                errors: err.message
                            });
                        }
                        // delete the temporary file, so that the explicitly set temporary upload dir does not get filled with unwanted files
                        fs.unlink(tmp_path, function() {
                            callback({
                                success: true,
                                msg: 'Uploaded successfully',
                                size: file.size,
                                name: file.name
                            });
                        });
                    });
                }catch(e) {
                    callback({
                        success: false,
                        msg: 'Upload failed',
                        errors: e.message
                    });
                }
            }else{
                callback({
                    success: false,
                    msg: 'No file',
                    params: params
                });
            }
        }

```

NOTE: Remember, that you can always invoke server-side methods if you need them, and receive the response inside the callback.
This way you are not limited to existing prebuilt use cases in different widgets.
Sample call would be simple as this:

```
ExtRemote.DXFormTest.testMe(3,
    function(res){
        console.dir(res);
    }
);

```

#### Basic serverside methods and their callbacks
```
   //regular functions MUST call callback.
    regularFunction: function(params, callback){
        callback({msg: params});
    },

    //sample that shows usage of event instead of RPC response
    messageFunction: function(params, callback){
        callback({}, 'message'); // add second parameter to callback, this way it wil be converted to event
    },

    customErrorFunction: function(params, callback){
        throw new Error("Something wrong happened"); // error handling is now fully supported

        //notice that in the case of error no callback will be invoked

        //if there will be other methods in batch, processing will continue for next transaction
    }
```

### Session support

As of version 1.1.0 sessions are supported within reference implementation. Set enableSessions to true.
When session support is enabled, on all methods 3rd parameter will be set to sessionID otherwise it's value will be null.
You have to implement authentication and session handling process according to your business requirements.
Example code:

```
var DXLogin  = {
    // method signature has 5 parameters
    /**
     *
     * @param params object with received parameters
     * @param callback callback function to call at the end of current method
     * @param sessionID - current session ID if "enableSessions" set to true, otherwise null
     * @param request only if "appendRequestResponseObjects" enabled
     * @param response only if "appendRequestResponseObjects" enabled
     */
    authenticate: function(params, callback, sessionID, request, response){
        var username = params.username;
        var password = params.password;
        console.log(sessionID);
        console.log(request);
        console.log(response);

        /*
         You have full access to all request properties
         */
        console.log(request.session); //e.g. retrieve session data

        response.header('My-Custom-Header ', '1234567890');
        /*
         Some code here to check login
         */
        callback({success:true, message:'Login successful'});


        /*
        //more detailed callback
        callback({
            success: true,
            message: 'Login successful',
            data: {
                firstName: 'Juris',
                lastName: 'Vecvanags',
                cookie: request.session.cookie
            }
        });
        */
    }
};

module.exports = DXLogin;
```

For more use cases please refer to ExtJs documentation.

### Server 'production' vs 'development' mode

By default Your node.js server is working in development mode, thus effectively spitting out a lot of useful dev-time info.
As of version 1.0.0 connector will look at the mode and change its behavior upon selection. 
For development mode it will return packets of type 'exception' whenever it will encounter one.
For production mode, instead it will return blank 'rpc' packet.

To change mode you have to set environment variable NODE_ENV to production.
There are 2 options.
1) in Terminal run the command: export NODE_ENV=production
2) Add permamently to your .bash_profile file:
```
echo export NODE_ENV=production >> ~/.bash_profile
source ~/.bash_profile
```
### Explicit 'exception' transactions

Sometimes you want to ensure that server won't crash during some actions, and/or send data back to client during process.
To do that you have to call the callback with additional parameters, like in this example:

```

conn.query(totalQuery, function(err, rowsTotal, fields) {
    mysql.disconnect(conn); //release connection

    //if (err) throw err;
    // Usually we throw an error like in the line above. This will throw an error to node.js console and exit the application.
    // As this is totally correct and common practice, sometimes we want to prevent that and treat the error differently

    // This is an example how to send back hard exception
    // Change totalQuery syntax, so it becomes invalid and observe the results
    // Client side won't break and if not in production mode, you wil receive message stating what was the error and where it was found
    // Same applies to any try{..some code that may fail..}catch(err){callback(null, 'exception', err);}
    if(err){
        callback(null, 'exception', err);
    }else{
        callback({
            success: true,
            data: rows,
            total: rowsTotal[0].totals
        });
    }
});

```


### Direct access to request and response objects
Version 1.3.0 adds this functionality if you configure router with parameter "appendRequestResponseObjects" and set it to true
Method signatures:

```

requestObjectsEnabled: function(params, callback, sessionID, request, response){

// Your code here

}

requestObjectsDisabled: function(params, callback, sessionID){

// Your code here

}

```

#### Example code
Sample applications for Touch and ExtJs can be found here: https://github.com/jurisv/extdirect.examples

It's work in progress, and hopefully it has enough code to get you started.


### Changelog:
* 1.3.1 (9 nov 2013)
        Fix parameter mismatch in api.js.
        <b>Important!</b>
        If you have floating amount of parameters instead of 1 object 'parameters' this might be a breaking change! Stay with version 1.2.0 or make appropriate changes.
        Changed file upload example. As we have request object as parameter, you can retrieve uploaded file/s directly from that object

* 1.3.0 (9 nov 2013)

        Add feature to access request and response objects from DX method.
        Standardize that DX method signature (all methods receive 5 parameters).1st is params from client, then callback, sessionID and request/response if configured to pass those parameters.
        Add related documentation, link to examples.

* 1.2.0 (23 oct 2013)

        Add feature to explicitly create transaction of type 'exception'

* 1.1.1 (15 oct 2013)

        Update Docs. Fix MySQL examples to prevent SQL Injection vulnerabilities.

* 1.1.0 (24 aug 2013)

        Update docs and sample server-side code to include CORS support
        Configs for protocol, server, port
        Refactor to pass one config object instead of multiple parameters
        New config parameters.
        Renamed some configs that were confusing. Check ExtDirectConfig config.
        <b>Important</b> Upgrade from v1.0.0:
        Adjust node.js main app.js and config.json files. Router and Api functions now expect config object instead of separate ordered parameters.

* 1.0.0 (18 july 2013)

        Announced and pushed to npmjs repository

* 1.0.0 (26 jun 2013)

        Limit exception type of packets to development mode only
        Add info on development/production mode settings in docs
        
* 0.9.9 (19 jun 2013)

        Added Windows support

* 0.9.8 (18 jun 2013)

        Added Session support plus examples
        Added Proper error handling- failed transactions will be returned as exceptions        
        Added Event support

* 0.9.7 (26 mar 2013)

        Fixed Markdown in Docs

* 0.9.6 (25 Mar 2013)

        Add form handling
        Add form file upload feature
        Add API generation caching
        Gracefully handle errors
        Add Code samples in README.md        

* 0.9.5 Minimal stable

* 0.9.0 Public release