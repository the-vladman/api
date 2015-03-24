// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent  = require( '../../buda_agent' );

// Custom requirements
var util       = require( 'util' );
var mongoose   = require( 'mongoose' );
var info       = require( '../package' );
var CSV        = require( 'csv-stream' );

// Storage schema basic definiton
var StorageSchema = mongoose.Schema({});

// Constructor method
function BudaCSVAgent( conf ) {
  BudaAgent.call( this, conf );
  
  // Log agent information
  this.log( 'Buda CSV Agent ver. ' + info.version );
  
  // Configure schema and model for storage
  StorageSchema.set( 'strict', false );
  StorageSchema.set( 'collection', this.config.storage.collection );
  var Doc = mongoose.model( 'Doc', StorageSchema );
  
  // Connect to DB
  var storage = this.config.storage.host + '/' + this.config.storage.db;
  mongoose.connect( 'mongodb://' + storage );
  
  // Configure data parser
  this.parser = CSV.createStream({
    delimiter: this.config.data.separator
  });
  
  // Self pointer
  var self = this;
  
  // Rewind on complete
  this.parser.on( 'end', function() {
    self.log( 'Processing done!' );
  });
  
  // Process each record
  this.parser.on( 'data', function( item ) {
    // Store record
    var record = new Doc( item );
    record.save( function( err ) {
      if( err ) {
        self.emit( 'error' );
      }
    });
    self.emit( 'hit' );
  });
}
util.inherits( BudaCSVAgent, BudaAgent );

// Disconnect from database on cleanup
BudaCSVAgent.prototype.cleanup = function() {
  this.log( 'Disconnect DB' );
  mongoose.disconnect();
};

module.exports = BudaCSVAgent;