### Sencha Ext.Direct connector for node.js

#### Compatibility:
* Sencha Touch 2.3+
* ExtJs 4.2.x+
* ExtJs 5+

#### Example code
Sample applications for Touch and ExtJs can be found here: https://github.com/jurisv/extdirect.examples

This covers most use cases

ExtJs:

    * Application structure with API provider
    * Grid CRUD Master-detail
    * Cookie / Session
    * Direct method call, shows regular call and onw that has hard exception (syntax error)
    * Form Load / Submit
    * Form file upload (Cross domain upload is not supported!)
    * Tree root / child dynamic load

Sencha Touch:

    * Application structure with API provider
    * List read using directFn
    * Form load / submit


####Please refer to provided examples for up to date sample implementation

-

###Client app modifications to support Ext.Direct

This new approach fully works both in development and production modes.
No changes in index.html file are required.

####Touch

Create new class inside your app folder and name ir DirectAPI.js

File DirectAPI.js
```js
Ext.define('DemoTouch.DirectAPI', {

     //Require Ext.Direct classes

    requires: ['Ext.direct.*']
}, function() {
    var Loader = Ext.Loader,
        wasLoading = Loader.isLoading;

    //Loading API
    Loader.loadScriptFile('http://localhost:3000/directapi', Ext.emptyFn, Ext.emptyFn, null, true);
    Loader.isLoading = wasLoading;

    // Add provider. Name must match settings on serverside
    Ext.direct.Manager.addProvider(ExtRemote.REMOTING_API);
});
```

File app.js
```js
Ext.application({
    name: 'DemoTouch',

    requires: [
        'DemoTouch.DirectAPI', // Require API loader
        'Ext.MessageBox',
        'DemoTouch.overrides.form.Panel'
    ],

```

####ExtJS
Create new class inside your app folder and name ir DirectAPI.js

File DirectAPI.js
```js
Ext.define('DemoExtJs.DirectAPI', {

     //Require Ext.Direct classes

    requires: ['Ext.direct.*']
}, function() {
    var Loader = Ext.Loader,
        wasLoading = Loader.isLoading;

    //Loading API
    Loader.loadScriptFile('http://localhost:3000/directapi', Ext.emptyFn, Ext.emptyFn, null, true);
    Loader.isLoading = wasLoading;

    // Add provider. Name must match settings on serverside
    Ext.direct.Manager.addProvider(ExtRemote.REMOTING_API);
});
```

Add string 'DemoExtJs.DirectAPI' to requires inside Application.js
File app.js

```js
Ext.define('DemoExtJs.Application', {
    name: 'DemoExtJs',

    requires:[
        'DemoExtJs.DirectAPI'
    ],

```

-
###Usage
####Method signature and structure of method

```js
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


####Sample direct methods for CRUD

```js
var table = 'todoitem';
var db = global.App.database;

var DXTodoItem  = {
    create: function(params, callback){
        var conn = db.connect();
        delete params['id'];
        conn.query('INSERT INTO ' + table + ' SET ?', params, function(err, result) {

            if (err) db.debugError(callback, err);

            conn.query('SELECT * FROM '  + table + ' WHERE id = ?', result.insertId, function(err, rows, fields) {
                db.disconnect(conn); //release connection
                callback({
                    success: true,
                    data: rows[0]
                });
            });
        });
    },

    //callback as last argument is mandatory
    read: function(params, callback){
        var conn = db.connect();

        var sql = 'SELECT * FROM ' + table,
            where = '';

        //filtering. this example assumes filtering on 1 field, as multiple field where clause requires additional info e.g. chain operator

        if(params.filter){
            where = " WHERE `"+ params.filter[0].property  + "` LIKE '%" + params.filter[0].value + "%'"; // set your business logic here to perform advanced where clause
            sql += where;
        }

        // this sample implementation supports 1 sorter, to have more than one, you have to loop and alter query
        if(params.sort){
            var s = params.sort[0];
            sql = sql + ' ORDER BY ' + conn.escape(s.property) +  ' ' + conn.escape(s.direction);
        }

        // Paging
        sql = sql + ' LIMIT ' + conn.escape(params.start) + ' , ' + conn.escape(params.limit);

        conn.query(sql, function(err, rows, fields) {
            if (err) db.debugError(callback, err);

            //get totals for paging

            var totalQuery = 'SELECT count(*) as totals from ' + table + where;

            conn.query(totalQuery, function(err, rowsTotal, fields) {
                db.disconnect(conn); //release connection
                if (err) db.debugError(callback, err);

                callback({
                    success: true,
                    data: rows,
                    total: rowsTotal[0].totals
                });
            });
        });
    },

    update: function(params, callback){
        var conn = db.connect();

        conn.query('UPDATE ' + table + ' SET ? where id = ' + conn.escape(params['id']), params, function(err, result) {
            db.disconnect(conn); //release connection
            if (err) db.debugError(callback, err);
            callback({success:true});
        });
    },

    destroy: function(params, callback){
        var conn = db.connect();

        conn.query('DELETE FROM ' + table + ' WHERE id = ?', conn.escape(params['id']), function(err, rows, fields) {
            if (err) db.debugError(callback, err);

            db.disconnect(conn); //release connection
            callback({
                success:rows.affectedRows === 1, //if row successfully removed, affected row will be equal to 1
                id:params['id']
            });
        });
    }
};

module.exports = DXTodoItem;
```

####How to configure your application model with direct proxy

```js
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

If you are using component with read only functionality, then you can specify directFn instead.
```js
Ext.define('DemoTouch.model.TodoItem', {
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
        sorters: [
            {
                property : "id",
                direction: "DESC"
            }
        ],
        proxy: {
            //Set proxy type
            type: 'direct',

            //Define direct method. For read only purposes
            directFn: 'ExtRemote.DXTodoItem.read',

            reader: {
                type: 'json',
                rootProperty: 'data',
                messageProperty:'message'
            }
        }
    }
});
```

####How to configure your form

```js
api:{
      load: 'ExtRemote.DXFormTest.load',
      submit:'ExtRemote.DXFormTest.submit'
}
```

####File upload inside the form

```js
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


```js
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
remember to mark your method with formHandler, as shown below:

```js
filesubmit: function(params, callback, sessionID, request, response/*formHandler*/){
        var files = request.files; //get files from request object
        // console.log(params, files)

        // Do something with uploaded file, e.g. move to another location
        var fs = require('fs'),
            file = files.photo,
            tmp_path = file.path;

        // set where the file should actually exists - in this case it is in the "demo" directory
        var target_path = './public/uploaded_images/' + file.name;

        var successfulUpload = function(cb){

        };

        var failedUpload = function(cd, error){

        };

        // move the file from the temporary location to the intended location
        // do it only if there is a file with size
        if(file.size > 0){
            try{
                fs.rename(tmp_path, target_path, function(err) {
                    if(err){
                        callback({
                            success: false,
                            msg: "Upload failed - can't rename the file",
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
//                callback({
//                    success: false,
//                    msg: "Upload failed - can't rename the file",
//                    errors: e.message
//                });
            }
        }else{
            callback({
                success: false,
                msg: "Upload failed - empty file",
                params: params,
                errors: {
                    clientCode: "File not found",
                    portOfLoading: "This field must not be null"
                }
            });
        }
    }

```

####Direct method invoking

If you are not relying on widgets, you can always invoke server-side methods if you need them, and receive the response inside the callback.
This way you are not limited to existing prebuilt use cases in different widgets.
Sample call would be simple as this:

```js
ExtRemote.DXFormTest.testMe(3,
    function(res){
        console.dir(res);
    }
);
```

#### Basic serverside methods and their callbacks

```js
    //Important! All methods at the end of processing instead of returning value must call callback function.
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

    //Every method always receive 5 parameters!

    var DXCollection  = {
        /**
         *
         * @param params object with received parameters
         * @param callback callback function to call at the end of current method
         * @param sessionID - current session ID if "enableSessions" set to true, otherwise null
         * @param request only if "appendRequestResponseObjects" enabled
         * @param response only if "appendRequestResponseObjects" enabled
         */
        publish: function(params, callback, sessionID, request, response){
        //..

```

####Session support

As of version 1.1.0 sessions are supported within reference implementation. Set enableSessions to true.
When session support is enabled, on all methods 3rd parameter will be set to sessionID otherwise it's value will be null.
You have to implement authentication and session handling process according to your business requirements.
Example code:

```js
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

For more use cases please refer to Sencha documentation.

####Server 'production' vs 'development' mode

By default Your node.js server is working in development mode, thus effectively spitting out a lot of useful dev-time info.
As of version 1.0.0 connector will look at the mode and change its behavior upon selection. 
For development mode it will return packets of type 'exception' whenever it will encounter one.
For production mode, instead it will return blank 'rpc' packet.

To change mode you have to set environment variable NODE_ENV to production.
There are 2 options.
1) in Terminal run the command: export NODE_ENV=production
2) Add permamently to your .bash_profile file:

```sh
echo export NODE_ENV=production >> ~/.bash_profile
source ~/.bash_profile
```

####Explicit 'exception' transactions

Sometimes you want to ensure that server won't crash during some actions, and/or send data back to client during process.
To do that you have to call the callback with additional parameters, like in this example:

```js

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

    //Best practice would be to call predefined method that handles exceptions
    //For example:
    debugError: function(fn, error){
            // Generate SOFT error, instead of throwing hard error.
            // We send messages with debug ingo only if in development mode

            if(global.App.mode === 'development'){
                fn({message: {
                    text: 'Database error',
                    debug: error
                }
                });
            }else{
                fn({message: {
                    text: 'Unknown error',
                    debug: null
                }
                });
            }
        }

        //and call it whenever it required:
        update: function(params, callback){
                var conn = db.connect();

                conn.query('UPDATE ' + table + ' SET ? where id = ' + conn.escape(params['id']), params, function(err, result) {
                    db.disconnect(conn); //release connection
                    if (err) db.debugError(callback, err);
                    callback({success:true});
                });
            },

});

```

#### Direct access to request and response objects
Version 1.3.0 adds this functionality if you configure router with parameter "appendRequestResponseObjects" and set it to true
Method signatures:

```js

requestObjectsEnabled: function(params, callback, sessionID, request, response){

// Your code here

}

requestObjectsDisabled: function(params, callback, sessionID){

// Your code here

}

```

#### Logging

Sample usage
```
var logger = function(action, method, params) {
    params = util.inspect(params, showHidden=false, depth=10, colorize=true);
    console.log('Direct Call: %s.%s(%s)', action, method, params);
}

var directCfg = {
    namespace: "ExtRemote",
    apiName: "REMOTING_API",
    apiPath: "/directapi",
    classPath: "/direct",
    classPrefix: "DX",
    relativeUrl: true,
    logging: logger // or just specify console.log
};
```



### Changelog:
* 2.0.0 (TBD)
    Closes: Comment source code and use descriptive variable names #21

* 1.3.6 (21 aug 2014)
         Fix typo

* 1.3.5 (19 aug 2014)
        Fix routing path so it will work for Windows

* 1.3.4 (5 aug 2014)

         Fix typo
         Fix routing when application is started by Passenger and not by node

* 1.3.3 (16 apr 2014)

        Add support for logging from router.

* 1.3.2 (11 jan 2014)

        Add support for relative Url. To keep backward compatibility it's set to false

* 1.3.1 (9 nov 2013)

        Fix parameter mismatch in api.js.
        Important!
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
