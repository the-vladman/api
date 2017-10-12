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
			description: { type: String, required: false },
			data: [
				{
					alphabet: [{value: String, anotherValue: [Number]}],
				}
			],
			meta: {
				tags: [String]
			}
		});

		let testModel = mongoose.model(testCollection, testSchema);

		var schema;
		var tagsOptions = ["apple", "banana", "grape", "orange", "avocado", "strawberry", "peaches"]
		for(let i = 0; i < 150; i++){
			schema = {
				name: "test_" + i,
				description: String(i%2),
				data: [],
				meta: {
					tags: []
				}
			}

			for( let j = 0; j < parseInt(Math.random()*10); j++){
				schema.data.push({
					alphabet: []
				});

				for( let k = 0; k < parseInt(Math.random()*10); k++){
					schema.data[j].alphabet.push({value: String(k), anotherValue: [j, k, i]});
				}
			}

			for( let j = 0; j < parseInt(Math.random()*3); j++){
				schema.meta.tags.push( tagsOptions[parseInt(Math.random()*tagsOptions.length)] );
			}

			new testModel(schema).save();
		}
	});


	describe('/GET recursive search key=[x, value, y, z]', () => {
		it('it should GET a list of records with at the array defined by key containing at least one time the value', (done) => {

			let valueToFind = "peaches";
			chai.request(api_home)
			.get('/v1/' + testCollection + "?tags=" + valueToFind + "&recursiveSearch=1")
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('object').have.property("results").be.a("array");

				for(var i = 0; i < res.body.results.length; i++){
					res.body.results[i].meta.tags.should.contains(valueToFind)
				}

				done();
				console.log("\tResponse: " + JSON.stringify(res.body.pagination) + "\n");
			});
		});
	});


	describe('/GET key=[x, value, y, z]', () => {
		it('it should GET a list of records with at the array defined by key containing at least one time the value', (done) => {

			let valueToFind = "peaches";
			chai.request(api_home)
			.get('/v1/' + testCollection + "?meta.tags=" + valueToFind)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('object').have.property("results").be.a("array");

				for(var i = 0; i < res.body.results.length; i++){
					res.body.results[i].meta.tags.should.contains(valueToFind)
				}

				done();
				console.log("\tResponse: " + JSON.stringify(res.body.pagination) + "\n");
			});
		});
	});


	describe('/GET nested search obj[key]=value', () => {
		it('it should GET a list of records with at least one pair key=value', (done) => {

			let valueToFind = "3";
			chai.request(api_home)
			.get('/v1/' + testCollection + "?value=" + valueToFind + "&recursiveSearch=1")
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('object').have.property("results").be.a("array");

				var isValid = false;
				resultsLoop:
				for(var i = 0; i < res.body.results.length; i++){
					// console.log(res.body.results[i])
					dataLoop:
					for(var j = 0; j < res.body.results[i].data.length; j++){
						// console.log(res.body.results[i].data[j])
						valueLoop:
						for(var k = 0; k < res.body.results[i].data[j].alphabet.length; k++){
							// console.log(res.body.results[i].data[j].alphabet[k].value, valueToFind);
							if(res.body.results[i].data[j].alphabet[k].value == valueToFind){
								isValid = true;
								break dataLoop;
							}
						}
					}

					isValid.should.be.ok;
				}

				done();
				console.log("\tResponse: " + JSON.stringify(res.body.pagination) + "\n");
			});
		});
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
		mongoose.connection.db.dropCollection(testCollection, function(err, result){});
	});
});
