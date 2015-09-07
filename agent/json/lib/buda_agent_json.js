// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var util = require( 'util' );
var mongoose = require( 'mongoose' );
var JSONStream = require( 'JSONStream' );
var info = require( '../package' );

// Storage schema basic definiton
var Doc;
var storage = null;
var StorageSchema = new mongoose.Schema({});

// Constructor method
function BudaJSONAgent( conf ) {
  var self = this;
  var bag = [];

  BudaAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda JSON Agent ver. ' + info.version );

  // Configure schema and model for storage
  StorageSchema.set( 'strict', false );
  StorageSchema.set( 'collection', self.config.storage.collection );
  Doc = mongoose.model( 'Doc', StorageSchema );

  // Connect to DB
  // The storage host will be collected from ENV and override as config parameter
  if( process.env.STORAGE_PORT ) {
    storage = process.env.STORAGE_PORT.replace( 'tcp://', '' );
  }
  if( self.config.storage.host ) {
    storage = self.config.storage.host;
  }

  // No storage located? exit with error
  if( ! storage ) {
    throw new Error( 'No storage available' );
  }

  // Append selected DB and connect
  storage += '/' + self.config.storage.db;
  mongoose.connect( 'mongodb://' + storage );

  // Configure data parser
  self.parser = JSONStream.parse( self.config.options.pointer );

  // Parser errors
  self.parser.on( 'error', function( err ) {
    throw err;
  });

  // Rewind on complete
  self.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      Doc.collection.insert( bag, function( err ) {
        if( err ) {
          throw err;
        }
      });
      bag = [];
    }
    self.log( 'Processing done!' );
  });

  // Process records
  self.parser.on( 'data', function( item ) {
    bag.push( item );
    if( bag.length === ( self.config.storage.batch || 50 ) ) {
      Doc.collection.insert( bag, function( err ) {
        if( err ) {
          throw err;
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
