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

var config = require('./test-config');
var server = require("../server")
var should = require('should');
var request = require('supertest');
var async = require('async');
var SIS = require("../util/constants");

var mongoose = null;
var schemaManager = null;
var app = null;
var httpServer = null;

describe('Entity Population API', function() {
    before(function(done) {
        server.startServer(config, function(expressApp, httpSrv) {
            mongoose = server.mongoose;
            schemaManager = expressApp.get(SIS.OPT_SCHEMA_MGR);
            app = expressApp;
            httpServer = httpSrv;
            done();
        });
    });

    after(function(done) {
        server.stopServer(httpServer, function() {
            mongoose.connection.db.dropDatabase();
            mongoose.connection.close();
            done();
        });
    });

    describe("Array references", function() {

        var createEntityManager = require("../util/entity-manager");

        var schema_1 = {
            "name" : "ref_1",
            "owner" : "entity_test",
            "definition" : {
                "name" : "String"
            }
        };

        var schema_2 = {
            "name" : "ref_2",
            "owner" : "entity_test",
            "definition" : {
                "name" : "String",
                "refs" : [{ type : "ObjectId", ref : "ref_1"}]
            }
        };

        var schema_3 = {
            "name" : "ref_3",
            "owner" : "entity_test",
            "definition" : {
                "name" : "String"
            }
        }

        var schema_4 = {
            "name" : "ref_4",
            "owner" : "entity_test",
            "definition" : {
                "name" : "String",
                "ref" : { type : "ObjectId", ref : "ref_1" },
                "ref_multi" : [{ type : "ObjectId", ref : "ref_1" }]
            }
        }

        var schemas = [schema_1, schema_2, schema_3, schema_4];
        var entities = {
            'ref_1' : [],
            'ref_3' : []
        }

        before(function(done) {
            // setup the schemas
            async.map(schemas, schemaManager.add.bind(schemaManager), function(err, res) {
                if (err) {
                    console.log(JSON.stringify(err));
                    return done(err, res);
                }
                var req = request(app);
                async.map(['foo', 'bar', 'baz'], function(name, callback) {
                    entity = { "name" : name }
                    req.post("/api/v1/entities/ref_1")
                        .set("Content-Type", "application/json")
                        .query("populate=false")
                        .send({
                            "name" : name
                        })
                        .expect(201, function(err, result) {
                            if (err) {
                                return callback(err, result);
                            }
                            result = result.body;
                            entities['ref_1'].push(result);

                            req.post("/api/v1/entities/ref_3")
                                .set("Content-Type", "application/json")
                                .query("populate=false")
                                .send({
                                    "name" : name
                                })
                                .expect(201, function(err, result) {
                                    if (err) { return callback(err, result); }
                                    result = result.body;
                                    entities['ref_3'].push(result);
                                    return callback(null, true)
                                });
                        });
                }, function(e, r) {
                    if (e) {
                        console.log(e);
                    }
                    done(e, r);
                });
            });
        });

        after(function(done) {
            var names = schemas.map(function(s) { return s.name; });
            async.map(names, schemaManager.delete.bind(schemaManager), done);
        });


        it("ref_2 should have oid reference paths", function(done) {
            var smModel = schemaManager.getEntityModel(schema_2);
            var refs = SIS.UTIL_GET_OID_PATHS(smModel);
            refs.length.should.eql(1);
            done();
        });

        it("should fail to add a bad ref_2", function(done) {
            var bad_refs = entities['ref_3'];
            var ids = [bad_refs[0]['_id'], bad_refs[1]['_id']];
            var entity = {
                'name' : 'bad_ref_2',
                'refs' : ids
            };
            request(app).post("/api/v1/entities/ref_2")
                .set("Content-Type", "application/json")
                .query("populate=false")
                .send(entity)
                .expect(400, function(err, result) {
                    result.statusCode.should.eql(400);
                    done();
                });
        });

        it("should add a good ref_2", function(done) {
            var good_refs = entities['ref_1'];
            var ids = [good_refs[0]['_id'], good_refs[1]['_id']];
            var entity = {
                'name' : 'good_ref_2',
                'refs' : ids
            };
            var req = request(app);
            req.post("/api/v1/entities/ref_2")
                .set("Content-Type", "application/json")
                .send(entity)
                .expect(201, function(err, result) {
                    should.not.exist(err);
                    result = result.body;
                    var id = result['_id'];
                    req.get("/api/v1/entities/ref_2/" + id)
                        .expect(200, function(e, r) {
                            result = r.body;
                            should.exist(result.refs);
                            should.exist(result.refs[0]);
                            should.exist(result.refs[0].name);
                            done();
                        });
                });
        });
    });

});