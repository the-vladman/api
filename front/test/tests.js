process.env.NODE_ENV="test"; // environment test

let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let chai = require('chai');
let chaiHttp = require('chai-http');
let should = chai.should();
chai.use(chaiHttp);

let server = require('../bin/buda-front');
let api_home = "localhost:8000";

let testCollection = "tests";
let validDocId;


describe("CRUD OPERATIONS", ()=>{

	before(function() {
		let testSchema = new Schema({
			name: { type: String, required: true },
			description: { type: String, required: false }
		});

		let testModel = mongoose.model(testCollection, testSchema);

		for(let i = 0; i < 10; i++){
			new testModel({name:"test_" + i, description:i%2}).save();
		}
	});

	// get all
	describe('/GET ' + testCollection, () => {
		it('it should GET a list of records', (done) => {

			chai.request(api_home)
				.get('/v1/' + testCollection)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object').have.property("results").be.a("array")

					validDocId = res.body.results[0]["_id"];
					done();
				});
		});
	});

	// get one
	describe('/GET/:docId ' + testCollection, () => {
		it('it should GET one record', (done) => {
			chai.request(api_home)
				.get('/v1/' + testCollection + '/' + validDocId)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object').have.property("_id").eql(validDocId);
					done();
				});
		});
	});

	// insert
	describe('/POST ' + testCollection, () => {
		it('it should INSERT one record in the db', (done) => {
			chai.request(api_home)
				.post('/v1/' + testCollection).send({name:"value"})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("_id");
					done();
				});
		});
	});

	// update
	describe('/PUT/:docId ' + testCollection, () => {
		it('it should UPDATE one record in the db with name="new_value"', (done) => {
			chai.request(api_home)
				.put('/v1/' + testCollection + '/' + validDocId).send({description:"put_value"})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("_id").eql(validDocId);
					done();
				});
		});
	});

	// update
	describe('/PATCH/:docId ' + testCollection, () => {
		it('it should UPDATE one record in the db with another_value="patch_value"', (done) => {

			chai.request(api_home)
				.patch('/v1/' + testCollection + '/' + validDocId).send({another_value:"patch_value"})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("_id").eql(validDocId);
					done();
				});
		});
	});


	describe('/DELETE/:docId ' + testCollection, () => {
		it('it should DELETE one record in the db', (done) => {

			chai.request(api_home)
				.delete('/v1/' + testCollection + '/' + validDocId)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("_id").eql(validDocId);
					done();
				});
		});
	});

});



/*
	OPERATIONS WITH WRONG PARAMS
*/
describe("OPERATIONS WITH WRONG PARAMS - Using collection: nottestCollection\n", ()=>{
	// bad collection
	describe('/GET notValidCollection', () => {
		it('it should GET a empty list of records', (done) => {

			chai.request(api_home)
				.get('/v1/notValidCollection')
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object').have.property("results");
					res.body.results.length.should.be.eql(0);
					done();
				});
		});
	});


	// bad document
	describe('/GET/:docId notValidCollection', () => {
		it('it should GET an INVALID_DOCUMENT_ID error', (done) => {

			chai.request(api_home)
				.get('/v1/notValidCollection/notValidDocument')
				.end((err, res) => {
					res.should.have.status(400);
					res.body.should.have.property("error").eql("INVALID_DOCUMENT_ID");
					done();
				});
		});
	});

	// insert without data
	describe('/POST notValidCollection', () => {
		it('it shouldn\'t POST with NO_DATA_PROVIDED error', (done) => {
			chai.request(api_home)
				.post('/v1/notValidCollection')
				.end((err, res) => {
					res.should.have.status(400);
					res.body.should.have.property("error").eql("NO_DATA_PROVIDED");
					done();
				});
		});
	});

	// update with wrong id
	describe('/PUT/:docId notValidCollection', () => {
		it('it should return ERROR and status code 500', (done) => {

			chai.request(api_home)
				.put('/v1/notValidCollection/notValidDocument').send({"name":"put_value"})
				.end((err, res) => {
					res.should.have.status(500);
					res.body.should.have.property("error");
					done();
				});
		});
	});

	// update without id
	describe('/PUT notValidCollection', () => {
		it('it should return an INVALID_PATH error and status code 404', (done) => {

			chai.request(api_home)
				.put('/v1/notValidCollection/').send({"name":"put_value"})
				.end((err, res) => {
					res.should.have.status(404);
					res.body.should.have.property("error").eql("INVALID_PATH");
					done();
				});
		});
	});


	describe('/PATCH/:docId notValidCollection', () => {
		it('it should return ERROR and status code 500', (done) => {

			chai.request(api_home)
				.patch('/v1/notValidCollection/notValidDocument').send({"name":"put_value"})
				.end((err, res) => {
					res.should.have.status(500);
					res.body.should.have.property("error");
					done();
				});
		});
	});

	describe('/PATCH notValidCollection', () => {
		it('it should return an INVALID_PATH error and status code 404', (done) => {

			chai.request(api_home)
				.patch('/v1/notValidCollection/').send({"name":"put_value"})
				.end((err, res) => {
					res.should.have.status(404);
					res.body.should.have.property("error").eql("INVALID_PATH");
					done();
				});
		});
	});

	describe('/DELETE/:docId notValidCollection', () => {
		it('it should return ERROR and status code 500', (done) => {

			chai.request(api_home)
				.delete('/v1/notValidCollection/notValidDocument')
				.end((err, res) => {
					res.should.have.status(500);
					res.body.should.have.property("error")
					done();
				});
		});
	});


	describe('/DELETE notValidCollection', () => {
		it('it should return an INVALID_PATH error and status code 404', (done) => {

			chai.request(api_home)
				.delete('/v1/notValidCollection')
				.end((err, res) => {
					res.should.have.status(404);
					res.body.should.have.property("error")
					done();
				});
		});
	});

	after(()=>{
		mongoose.connection.db.dropCollection(testCollection);
	});
});
