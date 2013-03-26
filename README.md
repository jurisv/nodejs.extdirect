# Sencha Ext.Direct connector for node.js 

Compatibility:
* Sencha Touch 2.1.x / 2.2
* ExtJs 4.2.x

Usage (Sencha Touch):
*** Create file/folder structure like this ***
````
/app.js
/config.json
/package.json
/public/ -> here you generate ST application using Sencha CMD
/direct/ -> here you will place all Ext.Direct files
/uploads/ -> file upload folder (must be writable by node.js)
````
### This example is using MySQL database
### File app.js:
````
var express = require('express'),
    nconf = require('nconf'),
    http = require('http'),
    path = require('path'),
    mysql = require('mysql'),
    extdirect = require('extdirect');

nconf.env().file({ file: 'config.json'});

var MySQL_HOSTNAME = nconf.get("MySQL_HOSTNAME"),
    MySQL_PORT = nconf.get("MySQL_PORT"),
    MySQL_USER = nconf.get("MySQL_USER"),
    MySQL_PASSWORD = nconf.get("MySQL_PASSWORD"),
    MySQL_DB = nconf.get("MySQL_DB"),

    EXTDIRECT_PATH = nconf.get("EXTDIRECT_PATH"),
    EXTDIRECT_NAMESPACE = nconf.get("EXTDIRECT_NAMESPACE"),
    EXTDIRECT_API_NAME = nconf.get("EXTDIRECT_API_NAME"),
    EXTDIRECT_PREFIX = nconf.get("EXTDIRECT_PREFIX");

var app = express();

var connection = function(){
    var conn = mysql.createConnection({
        host: MySQL_HOSTNAME,
        port: MySQL_PORT,
        user: MySQL_USER,
        password: MySQL_PASSWORD,
        database: MySQL_DB
    });

    conn.connect(function(err) {
        if(err){
            console.error('Connection had errors: ', err.code);
            process.exit(1);
        }
    });

    return conn;
};

var mysqlDisconnect = function(conn){
    conn.end();
};

// Make MySql connections available globally, so we can access them from within modules
global['MySQLConnection'] =  {
    connection : connection,
    disconnect : mysqlDisconnect
};

app.configure(function(){
    app.set('port', process.env.PORT || 3000);
    app.use(express.logger('dev'));
    app.use(express.bodyParser({uploadDir:'./uploads'})); //take care of body parsing/multipart/files
    app.use(express.methodOverride());
    app.use(express.compress()); //Performance - we tell express to use Gzip compression
    //app.use(app.router); // enable if you are using routes
    app.use(express.static(path.join(__dirname, 'public')));
});

app.get('/directapi', function(request, response) {
    var api = extdirect.getAPI(EXTDIRECT_NAMESPACE, EXTDIRECT_API_NAME, EXTDIRECT_PATH, EXTDIRECT_PREFIX);
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(api);
});

app.get(EXTDIRECT_PATH, function(request, response) {
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({success:false, msg:'Unsupported method. Use POST instead.'}));
});

app.post(EXTDIRECT_PATH, function(request, response) {
    extdirect.processRoute(request, response, EXTDIRECT_PATH);
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});


````
#package.json:
````
{
    "name": "touch-direct",
    "version": "0.1.0",
    "private": true,
    "scripts": {
        "start": "node app"
    },
    "dependencies": {
        "express": "3.1.0",
        "nconf": "~0.6.7",
        "mysql": "~2.0.0",
        "extdirect":"~0.9.7"
    }
}
````
# config.json(if you don't use Mysql you can omit those lines. Be sure to take away all related code then in app.js):
````
{
    "MySQL_HOSTNAME": "localhost",
    "MySQL_PORT": 3306,
    "MySQL_USER": "script",
    "MySQL_PASSWORD": "JxJSNa3stRYSV68j",
    "MySQL_DB": "demo",

    "EXTDIRECT_NAMESPACE" : "ExtRemote",
    "EXTDIRECT_API_NAME" : "REMOTING_API",
    "EXTDIRECT_PATH" : "/direct",
    "EXTDIRECT_PREFIX" : "DX"
}
````
# *** Touch application modifications ***

For you Sencha touch application you have to add the following lines inside Touch application main /public/app.js file:
````
Ext.require([
    'Ext.direct.*'
]);

Ext.onReady(function(){
    Ext.direct.Manager.addProvider(ExtRemote.REMOTING_API);
});
````

/public/index.html(add the line for requesting API): 
````
<!-- The line below must be kept intact for Sencha Command to build your application -->
    <script id="microloader" type="text/javascript" src="touch/microloader/development.js"></script>
    <script type="text/javascript" src="/directapi"></script>
````
# *** Sample direct methods ***
Create file /direct/DXTodoItem.js :
````
var table = 'todoitem';
var mysql = MySQLConnection;

var DXTodoItem  = {
    create: function(params, callback){
        var conn = mysql.connection();
        delete params['id'];
        conn.query('INSERT INTO ' + table + ' SET ?', params, function(err, result) {
            if (err) throw err;

            conn.query('SELECT * FROM '  + table + ' WHERE id = ?', result.insertId, function(err, rows, fields) {

                callback(rows);

                mysql.disconnect(conn); //always disconnect
            });
        });
    },

    //callback as last argument in mandatory
    read: function(params, callback){
        var conn = mysql.connection();

        var sql = 'SELECT * from ' + table;
        // this sample implementation supports 1 sorter, to have more than one, you have to loop and alter query
        if(params.sort){
            var s = params.sort[0];
            sql = sql + ' order by ' + s.property +  ' ' + s.direction;
        }

        // Paging
        sql = sql + ' limit ' + params.start + ' , ' + params.limit;

        conn.query(sql, function(err, rows, fields) {
            if (err) throw err;

            //ST2.1 List / Dataview response
            callback(rows);
        });

        mysql.disconnect(conn); //always disconnect
    },

    update: function(params, callback){
        var conn = mysql.connection();

        conn.query('UPDATE ' + table + ' SET ? where id = ' + conn.escape(params['id']), params, function(err, result) {
            if (err) throw err;
            callback({success:true});
        });
        mysql.disconnect(conn); //always disconnect
    },

    destroy: function(params, callback){
        var conn = mysql.connection();

        conn.query('DELETE FROM ' + table + ' WHERE id = ?', params['id'], function(err, rows, fields) {
            callback({success:true, id:params['id']});
        });
        mysql.disconnect(conn); //always disconnect
    }
};

module.exports = DXTodoItem;
````

# *** Configure your application model with direct proxy  ***
````
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
````

##  *** ExtJS 4.2.x ***

Server-side structure remains the same as for Sencha Touch.

For your ExtJs app add in /public/app.js :
````
Ext.require([
    'Ext.direct.*'
]);

Ext.onReady(function(){
    Ext.direct.Manager.addProvider(ExtRemote.REMOTING_API);
});
````

Index file /public/index.html
````
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
        <script src="app/app.js"></script>
        <!-- Ext.Direct -->
        <script src="/directapi"></script>
    <!-- </x-compile> -->
</head>
<body></body>
</html>
````

Then for your directCfg, and api definitions use string literals of methods,
like this:

Form:
````
api:{
      load: 'ExtRemote.DXFormTest.load',
      submit:'ExtRemote.DXFormTest.submit'
}
````
Grid store with directFn:

````
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
````
Even more interesting is the file upload case:
## ExtJs config
````        
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
````
## node.js sample for upload/submit/test/load 

File:DXFormTest
````
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
````
When dealing with forms that submit via submit api method or upload a file,
remember to mark your method with formHandler, as shown below
````
    filesubmit: function(params, files, callback/*formHandler*/){
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

                    // delete the temporary file, so that the explicitly set temporary upload dir does not get filled with unwanted files
                    fs.unlink(tmp_path, function() {
                        if (err) throw err;
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
                success: true,
                msg: 'No file',
                params: params
            });
        }
    }
};

module.exports = DXFormTest;
````

NOTE: Remember, that you can always invoke serverside methods if you need them, and receive the response inside the callback.
This way you are not limited to existing prebuilt use cases in different widgets.
Sample call would be simple as this:
````
ExtRemote.DXFormTest.testMe(3,
    function(res){
        console.dir(res);
    }
);

````

For more use cases please refer to ExtJs documentation.

Changelog:
* 0.9.7 (26 mar 2013):
        Fixed Markdown in Docs
* 0.9.6 (25 Mar 2013):
        Add form handling
        Add form file upload feature
        Add API generation caching
        Gracefully handle errors
        Add Code samples in README.md

* 0.9.5 Minimal stable
* 0.9.0 Public release
