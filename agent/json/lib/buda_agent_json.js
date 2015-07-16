// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent  = require( '../../buda_agent' );

// Custom requirements
var util       = require( 'util' );
var mongoose   = require( 'mongoose' );
var JSONStream = require( 'JSONStream' );
var info       = require( '../package' );

// Storage schema basic definiton
var StorageSchema = mongoose.Schema({});

// Constructor method
function BudaJSONAgent( conf ) {
  BudaAgent.call( this, conf );
  
  // Log agent information
  this.log( 'Buda JSON Agent ver. ' + info.version );
  
  // Configure schema and model for storage
  StorageSchema.set( 'strict', false );
  StorageSchema.set( 'collection', this.config.storage.collection );
  var Doc = mongoose.model( 'Doc', StorageSchema );
  
  // Connect to DB
  // If we're running inside a container some ENV variables should be
  // set, otherwise assume is a local run and fallback to localhost storage
  var storage = '';
  if( process.env.STORAGE_PORT ) {
    storage += process.env.STORAGE_PORT.replace( 'tcp://', '' );
  } else {
    storage += 'localhost:27017';
  }
  storage += '/' + this.config.storage.db;
  mongoose.connect( 'mongodb://' + storage );
  
  // Configure data parser
  this.parser = JSONStream.parse( this.config.data.pointer );
  
  // Self pointer
  var self = this;
  
  // Rewind on complete
  this.parser.on( 'end', function() {
    self.log( 'Processing done!' );
  });
  
  // Process records
  var bag = [];
  this.parser.on( 'data', function( item ) {
    bag.push( item );
    if( bag.length == 25 ) {
      Doc.collection.insert( bag, function( err ) {
        if( err ) {
          self.log( 'Storage error', 'error', err );
        }
      });
      bag = [];
    }
  });
}
util.inherits( BudaJSONAgent, BudaAgent );

// Disconnect from database on cleanup
BudaJSONAgent.prototype.cleanup = function() {
  this.log( 'Disconnect DB' );
  mongoose.disconnect();
};

module.exports = BudaJSONAgent;