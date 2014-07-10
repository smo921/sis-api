/***********************************************************

 The information in this document is proprietary
 to VeriSign and the VeriSign Product Development.
 It may not be used, reproduced or disclosed without
 the written approval of the General Manager of
 VeriSign Product Development.

 PRIVILEGED AND CONFIDENTIAL
 VERISIGN PROPRIETARY INFORMATION
 REGISTRY SENSITIVE INFORMATION

 Copyright (c) 2013 VeriSign, Inc.  All rights reserved.

 ***********************************************************/

(function() {

'use strict';

var SIS = require('./constants');

// schema definitions
module.exports.schemas = [
    // sis_schemas
    {
        name : SIS.SCHEMA_SCHEMAS,
        definition : {
            name : { type : "String", required : true, unique : true, match : /^[a-z0-9_]+$/ },
            description : { type : "String" },
            sis_locked : { type : "Boolean", required : true, "default" : false },
            owner : { type : ["String"], required : true },
            definition : { type : {}, required : true },
            locked_fields : { type : ["String"] },
            track_history : { type : "Boolean", default : true },
            is_open : { type : "Boolean", default : false },
            _references : ["String"]
        }
    },
    // sis_hooks
    {
        name : SIS.SCHEMA_HOOKS,
        definition : {
            name : { type : "String", required : true, unique : true, match : /^[a-z0-9_]+$/ },
            target : {
                    type : {
                        url : { type : "String", required : true },
                        action : { type : "String", required : true, enum : ["GET", "POST", "PUT"]}
                    },
                    required : true
            },
            retry_count : { type : "Number", min : 0, max : 20, "default" : 0 },
            retry_delay : { type : "Number", min : 1, max : 60, "default" : 1 },
            events : { type : [{ type : "String", enum : SIS.EVENTS_ENUM }], required : true },
            owner : { type : ["String"] },
            entity_type : { type: "String", required: true },
            sis_locked : { type : "Boolean", required : true, "default" : false },
        }
    },
    // sis_hiera
    {
        name : SIS.SCHEMA_HIERA,
        definition : {
            name : { type : "String", required : true, unique : true },
            owner : { type : ["String"] },
            hieradata : { type : {}, required : true }
        }
    },
    // sis_commits
    {
        name : SIS.SCHEMA_COMMITS,
        definition : {
            type : { required : true, type : "String" },
            entity_id : { required : true, type : "String" },
            entity_oid : { required : true, type : "String" },
            action : { type : "String", required : true, enum : SIS.EVENTS_ENUM},
            commit_data : "Mixed",
            date_modified : { type : "Number", "index" : true },
            modified_by : "String"
        },
        indexes : [
            { type: 1, entity_id: 1 }
        ]
    },
    // sis_users
    {
        name : SIS.SCHEMA_USERS,
        definition : {
            name : { type : "String", required : true,  unique : true, match :  /^[a-z0-9_\-]+$/ },
            email : { type : "String", required : true,  match: /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/ },
            verified : { type : "Boolean", "default" : false },
            super_user : { type : "Boolean", "default" : false },
            pw : { type : "String" },
            roles : { type : {}, "default" : { } }
        }
    },
    // sis_tokens
    {
        name : SIS.SCHEMA_TOKENS,
        definition : {
            // the token itself
            name : { type : "String", unique : true },
            desc : "String",
            expires : { type : "Date", expires : 0 },
            username : { type: "String", required : true }
        }
    }

];

})();
