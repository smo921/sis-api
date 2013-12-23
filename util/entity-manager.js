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

'use strict';

// Manager for entities
(function() {

    var Manager = require("./manager");
    var Q = require("q");
    var SIS = require("./constants");
    var async = require("async");

    //////////
    // Entity manager
    function EntityManager(model, schema, opts) {
        this.schema = schema;
        Manager.call(this, model, opts);
        this.sm = opts[SIS.OPT_SCHEMA_MGR];
    }

    // inherit
    EntityManager.prototype.__proto__ = Manager.prototype;

    EntityManager.prototype.fixSubObject = function(entity, reference, isUpdate) {
        var obj = entity;
        // operate on a copy
        reference = reference.slice(0);
        var last = reference.pop();
        for (var i = 0; i < reference.length; ++i) {
            var path = reference[i];
            if (path in obj) {
                obj = path[obj];
            } else {
                // done - it's not set
                return null;
            }
        }
        // check if we have the object and
        // the path is in it
        if (!obj || !(last in obj)) {
            // nothing
            return null;
        }
        var subDoc = obj[last];
        if (typeof subDoc == 'object') {
            if (!isUpdate) {
                return "Unable to add reference document.  Must be an object id";
            } else {
                if (!(SIS.FIELD_ID in subDoc)) {
                    // nuke the entry
                    delete obj[last];
                } else {
                    // set it
                    obj[last] = subDoc[SIS.FIELD_ID];
                }
            }
        }
        return null;
    }

    // validate the entity
    EntityManager.prototype.validate = function(entity, isUpdate) {
        if (isUpdate) {
            // remove reserved fields..
            var keys = Object.keys(entity);
            for (var i = 0; i < keys.length; ++i) {
                var rf = keys[i];
                if (rf[0] == '_') {
                    delete entity[rf];
                }
            }
        }
        try {
            var keys = Object.keys(entity);
            if (keys.length == 0) {
                return "entity cannot be empty";
            }
            for (var i = 0; i < keys.length; ++i) {
                if (keys[i][0] == '_') {
                    return keys[i] + " is a reserved field";
                }
            }
            // handle sub objects
            for (var i = 0; i < this.references.length; ++i) {
                var err = this.fixSubObject(entity, this.references[i], isUpdate);
                if (err) {
                    return err;
                }
            }
            if (SIS.FIELD_OWNER in entity) {
                var err = this.validateOwner(entity);
                if (err) {
                    return err;
                }
                // ensure the document is a subset of owners of the schema
                var owners = entity[SIS.FIELD_OWNER];
                var schemaOwners = this.schema[SIS.FIELD_OWNER];
                for (var i = 0; i < owners.length; ++i) {
                    if (schemaOwners.indexOf(owners[i]) == -1) {
                        // must be a subset
                        return "entity owners must be a subset of the schema owners.";
                    }
                }
            }
        } catch (ex) {
            return "cannot be empty or is not an object " + ex;
        }
        return null;
    }

    EntityManager.prototype.authorize = function(evt, doc, user, mergedDoc) {
        // authorize against entity subset or schema
        if (doc[SIS.FIELD_OWNER]) {
            if (mergedDoc && !mergedDoc[SIS.FIELD_OWNER]) {
                // needs to use the schema owner..
                mergedDoc[SIS.FIELD_OWNER] = this.schema[SIS.FIELD_OWNER];
            }
            return Manager.prototype.authorize.call(this, evt, doc, user, mergedDoc);
        } else {
            // schema. so ensure we have the permission to do so
            var permission = this.getPermissionsForObject(this.schema, user);
            if (permission == SIS.PERMISSION_ADMIN ||
                permission == SIS.PERMISSION_USER_ALL_GROUPS) {
                return Q(mergedDoc || doc);
            } else {
                return Q.reject("Insufficient privileges to operate on entities in this schema.");
            }
        }
    }

    EntityManager.prototype.applyUpdate = function(result, entity) {
        var schema = result.schema;
        for (var k in entity) {
            if (schema.path(k)) {
                if (entity[k] != null) {
                    result[k] = this.applyPartial(result[k], entity[k]);
                } else {
                    delete result[k];
                }
            }
        }
        return result;
    }

    EntityManager.prototype.getEnsureReference = function(obj) {
        return function(ref, callback) {
            var currObj = obj;
            var path = null;
            for (var i = 0; i < ref.length; ++i) {
                path = ref[i];
                if (!(path in currObj)) {
                    return callback(null, true);
                }
                currObj = currObj[path];
            }
            if (!currObj) {
                return callback(null, true);
            }
            path = ref.join(".");
            var schema = this.model.schema;
            ref = schema.path(path);
            var refModelName = ref.options.ref;
            this.sm.getSisModelAsync(refModelName, function(err, model) {
                if (err) { return callback(err, false); }
                model.findOne({'_id' : currObj}, function(e, r) {
                    if (e) {
                        callback(SIS.ERR_INTERNAL(e), false);
                    } else if (!r) {
                        callback(SIS.ERR_BAD_REQ("Reference with id " + currObj + " does not exist."), false);
                    } else {
                        callback(null, true);
                    }
                });
            });
        }.bind(this);
    }

    EntityManager.prototype.ensureReferences = function(obj) {
        if (this.references.length == 0 || !obj) {
            return Q(obj);
        }
        // convert to POJO
        var result = obj;
        if (obj.toObject) {
            obj = obj.toObject();
        }
        // ensure the references exist
        var d = Q.defer();
        async.map(this.references, this.getEnsureReference(obj), function(err, ignored) {
            if (err) {
                d.reject(err);
            } else {
                d.resolve(result);
            }
        });
        return d.promise;
    }

    EntityManager.prototype._save = function(obj, callback) {
        // ensure references
        var p = this.ensureReferences(obj)
            .then(Manager.prototype._save.bind(this));
        return Q.nodeify(p, callback);
    }
    //////////

    module.exports = function(model, schema, opts) {
        return new EntityManager(model, schema, opts);
    }

})();