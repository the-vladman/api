process.env.NODE_ENV = "test"; // environment test

let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let chai = require('chai');
let chaiHttp = require('chai-http');
let should = chai.should();
chai.use(chaiHttp);

let server = require('../bin/buda-front');
let api_home = "localhost:" + server.config.port;

let testCollection = "tests";
let testCollectionSize = 50;
let validDocId;


describe("BUDA API FRONT TESTS", function() {

  before(function(done) {
    let testSchema = new Schema({
      name: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: false
      },
      data: [{
        alphabet: [{
          value: String,
          anotherValue: [Number]
        }],
      }],
      meta: {
        tags: [String]
      }
    });

    let testModel = mongoose.model(testCollection, testSchema);

    var schema;
    var tagsOptions = ["apple", "banana", "grape", "orange", "avocado", "strawberry", "peaches"]
    for (let i = 0; i < testCollectionSize; i++) {
      schema = {
        name: "test_" + i,
        description: String(i % 2),
        data: [],
        meta: {
          tags: []
        }
      }

      for (let j = 0; j < parseInt(Math.random() * 10); j++) {
        schema.data.push({
          alphabet: []
        });

        for (let k = 0; k < parseInt(Math.random() * 10); k++) {
          schema.data[j].alphabet.push({
            value: String(k),
            anotherValue: [j, k, i]
          });
        }
      }

      for (let j = 0; j < parseInt(Math.random() * 3); j++) {
        schema.meta.tags.push(tagsOptions[parseInt(Math.random() * tagsOptions.length)]);
      }

      new testModel(schema).save(function(err, doc) {
        if (!validDocId) {
          validDocId = String(doc["_id"]);
        }
      });
    }

    done();
  });

  afterEach(function() {
    console.log("");
  });


  describe("CRUD OPERATIONS", function() {
    this.timeout(10000);

    // get all
    describe('/GET ', function() {
      it('it should GET a list of records with length of ' + testCollectionSize, function(done) {
        chai.request(api_home)
          .get('/v1/' + testCollection)
          .end(function(err, res) {
            res.should.have.status(200);
            res.body.should.be.a('object').have.property("results").be.a("array");
            res.body.results.should.have.lengthOf(testCollectionSize);

            done();
          });
      });
    });

    // get one
    describe('/GET/:docId ', function() {
      it('it should GET one record', function(done) {
        chai.request(api_home)
          .get('/v1/' + testCollection + '/' + validDocId)
          .end(function(err, res) {
            res.should.have.status(200);
            res.body.should.be.a('object').have.property("_id").eql(validDocId);

            done();
          });
      });
    });


    // insert
    describe('/POST ', function() {
      it('it should return error code 403 - Forbidden', function(done) {
        chai.request(api_home)
          .post('/v1/' + testCollection).send({
            name: "value"
          })
          .end(function(err, res) {
            res.should.have.status(403);
            res.body.should.have.property("error").eql("Forbidden");

            done();
          });
      });
    });


    // update PUT
    describe('/PUT/:docId ', function() {
      it('it should return error code 403 - Forbidden', function(done) {

        chai.request(api_home)
          .put('/v1/' + testCollection + '/' + validDocId)
          .send({
            another_value: "put_value"
          })
          .end(function(err, res) {
            res.should.have.status(403);
            res.body.should.have.property("error").eql("Forbidden");

            done();
          });
      });
    });


    // update PATCH
    describe('/PATCH/:docId ', function() {
      it('it should return error code 403 - Forbidden', function(done) {

        chai.request(api_home)
          .patch('/v1/' + testCollection + '/' + validDocId)
          .send({
            another_value: "patch_value"
          })
          .end(function(err, res) {
            res.should.have.status(403);
            res.body.should.have.property("error").eql("Forbidden");
            done();
          });
      });
    });


    describe('/DELETE/:docId ', function() {
      it('it should return error code 403 - Forbidden', function(done) {

        chai.request(api_home)
          .delete('/v1/' + testCollection + '/' + validDocId)
          .end(function(err, res) {
            res.should.have.status(403);
            res.body.should.have.property("error").eql("Forbidden");

            done();
          });
      });
    });
  });


  describe("FILTERS", function() {
    this.timeout(10000);

    describe("/GET recursive search key=[x, value, y, z]", function() {
      it('it should GET a list of records with at the array defined by key containing at least one time the value', function(done) {

        let valueToFind = "peaches";
        chai.request(api_home)
          .get('/v1/' + testCollection)
          .query({
            "tags": valueToFind,
            "recursiveSearch": 1
          })
          .end(function(err, res) {
            res.should.have.status(200);
            res.body.should.be.a('object').have.property("results").be.a("array");

            for (var i = 0; i < res.body.results.length; i++) {
              res.body.results[i].meta.tags.should.contains(valueToFind);
            }

            done();
          });
      });
    });



    describe('/GET key=[x, value, y, z]', function() {
      it('it should GET a list of records with at the array defined by key containing at least one time the value', function(done) {

        let valueToFind = "peaches";
        chai.request(api_home)
          .get('/v1/' + testCollection)
          .query({
            "meta.tags": valueToFind
          })
          .end(function(err, res) {
            res.should.have.status(200);
            res.body.should.be.a('object').have.property("results").be.a("array");

            for (var i = 0; i < res.body.results.length; i++) {
              res.body.results[i].meta.tags.should.contains(valueToFind);
            }

            done();
          });
      });
    });


    describe('/GET nested search obj[key]=value', function() {
      it('it should GET a list of records with at least one pair key=value', function(done) {

        let valueToFind = "3";
        chai.request(api_home)
          .get('/v1/' + testCollection)
          .query({
            value: valueToFind,
            recursiveSearch: 1
          })
          .end(function(err, res) {
            res.should.have.status(200);
            res.body.should.be.a('object').have.property("results").be.a("array");

            var isValid;
            resultsLoop:
              for (var i = 0; i < res.body.results.length; i++) {
                isValid = false;

                dataLoop:
                  for (var j = 0; j < res.body.results[i].data.length; j++) {
                    valueLoop: for (var k = 0; k < res.body.results[i].data[j].alphabet.length; k++) {
                      if (res.body.results[i].data[j].alphabet[k].value == valueToFind) {
                        isValid = true;
                        break dataLoop;
                      }
                    }
                  }

                isValid.should.be.ok;
              }

            done();
          });
      });
    });

  });


  describe("CRUD OPERATIONS WITH WRONG PARAMS", function() {
    this.timeout(10000);

    // bad collection
    describe('/GET notValidCollection', function() {
      it('it should GET a empty list of records', function(done) {

        chai.request(api_home)
          .get('/v1/notValidCollection')
          .end(function(err, res) {
            res.should.have.status(200);
            res.body.should.be.a('object').have.property("results");
            res.body.results.length.should.be.eql(0);

            done();
          });
      });
    });

    // bad document
    describe('/GET/:docId notValidCollection', function() {
      it('it should return an INVALID_DOCUMENT_ID error', function(done) {

        chai.request(api_home)
          .get('/v1/notValidCollection/notValidDocument')
          .end(function(err, res) {
            res.should.have.status(400);
            res.body.should.have.property("error").eql("INVALID_DOCUMENT_ID");

            done();
          });
      });
    });

    // insert without data
    describe('/POST notValidCollection', function() {
      it('it should return error code 403 - Forbidden', function(done) {
        chai.request(api_home)
          .post('/v1/notValidCollection')
          .end(function(err, res) {
            res.should.have.status(403);
            res.body.should.have.property("error").eql("Forbidden");

            done();
          });
      });
    });


    // update with wrong id
    describe('/PUT/:docId notValidCollection', function() {
      it('it should return error code 403 - Forbidden', function(done) {

        chai.request(api_home)
          .put('/v1/notValidCollection/notValidDocument').send({
            "name": "put_value"
          })
          .end(function(err, res) {
            res.should.have.status(403);
            res.body.should.have.property("error").eql("Forbidden");
            done();
          });
      });
    });

    // update without id
    describe('/PUT notValidCollection', function() {
      it('it should return an INVALID_PATH error and status code 404', function(done) {

        chai.request(api_home)
          .put('/v1/notValidCollection/').send({
            "name": "put_value"
          })
          .end(function(err, res) {
            res.should.have.status(404);
            res.body.should.have.property("error").eql("INVALID_PATH");
            done();
          });
      });
    });


    describe('/PATCH/:docId notValidCollection', function() {
      it('it should return error code 403 - Forbidden', function(done) {

        chai.request(api_home)
          .patch('/v1/notValidCollection/notValidDocument').send({
            "name": "put_value"
          })
          .end(function(err, res) {
            res.should.have.status(403);
            res.body.should.have.property("error").eql("Forbidden");
            done();
          });
      });
    });

    describe('/PATCH notValidCollection', function() {
      it('it should return an INVALID_PATH error and status code 404', function(done) {

        chai.request(api_home)
          .patch('/v1/notValidCollection/').send({
            "name": "put_value"
          })
          .end(function(err, res) {
            res.should.have.status(404);
            res.body.should.have.property("error").eql("INVALID_PATH");
            done();
          });
      });
    });


    describe('/DELETE/:docId notValidCollection', function() {
      it('it should return error code 403 - Forbidden', function(done) {

        chai.request(api_home)
          .delete('/v1/notValidCollection/notValidDocument')
          .end(function(err, res) {
            res.should.have.status(403);
            res.body.should.have.property("error").eql("Forbidden");
            done();
          });
      });
    });


    describe('/DELETE notValidCollection', function() {
      it('it should return an INVALID_PATH error and status code 404', function(done) {

        chai.request(api_home)
          .delete('/v1/notValidCollection')
          .end(function(err, res) {
            res.should.have.status(404);
            res.body.should.have.property("error");
            done();
          });
      });
    });

  });

  after(function() {
    mongoose.connection.db.dropCollection(testCollection);
  });
});
