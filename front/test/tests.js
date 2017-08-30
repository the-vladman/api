
process.env.NODE_ENV="test";

let chai = require('chai');
let chaiHttp = require('chai-http');
let should = chai.should();
chai.use(chaiHttp);

let server = require('../bin/buda-front');
let api_home = "localhost:8000";

let validCollection = "calidadAire";
let validDocId = "5994900090120a4cf3c9aa33";

let testCollection = "test_collection";
let testDocId = "";

console.log("\n\tStarting tests...");

/*
	GET DOCUMENTS
*/
describe("GET DOCUMENTS - Using collection: " + validCollection + "\n", ()=>{
	describe('/GET ' + validCollection, () => {
		it('it should GET a list of records', (done) => {

			chai.request(api_home)
				.get('/v1/' + validCollection)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.be.a('object').have.property("results").be.a("array")
					done();
				});
		});
	});

	describe('/GET/:docId ' + validCollection, () => {
		it('it should GET one record with _id=' + validDocId 	, (done) => {
			chai.request(api_home)
				.get('/v1/' + validCollection + '/' + validDocId)
				.end((err, res) => {
					console.log(res.body)

					res.should.have.status(200);
					res.body.should.be.a('object').have.property("_id").eql(validDocId);
					done();
				});
		});
	});
})




/*
	CRUD OPERATIONS
*/
describe("CRUD OPERATIONS - Using collection: " + testCollection + "\n", ()=> {
	describe('/POST ' + testCollection, () => {
		it('it should INSERT one record in the db', (done) => {
			chai.request(api_home)
				.post('/v1/' + testCollection).send({"name":"value"})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("_id");

					testDocId = res.body["_id"];
					done();
				});
		});
	});


	describe('/PUT/:docId ' + testCollection, () => {
		it('it should UPDATE one record in the db with name="new_value"', (done) => {

			chai.request(api_home)
				.put('/v1/' + testCollection + '/' + testDocId).send({"name":"put_value"})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("_id").eql(testDocId);
					done();
				});
		});
	});


	describe('/PATCH/:docId ' + testCollection, () => {
		it('it should UPDATE one record in the db with another_value="patch_value"', (done) => {

			chai.request(api_home)
				.patch('/v1/' + testCollection + '/' + testDocId).send({"another_value":"patch_value"})
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("_id").eql(testDocId);
					done();
				});
		});
	});


	describe('/DELETE/:docId ' + testCollection, () => {
		it('it should DELETE one record in the db', (done) => {

			chai.request(api_home)
				.delete('/v1/' + testCollection + '/' + testDocId)
				.end((err, res) => {
					res.should.have.status(200);
					res.body.should.have.property("_id").eql(testDocId);
					done();
				});
		});
	});
});



/*
	OPERATIONS WITH WRONG PARAMS
*/
describe("OPERATIONS WITH WRONG PARAMS - Using collection: notValidCollection\n", ()=>{
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
});
