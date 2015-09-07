// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var util = require( 'util' );
var mongoose = require( 'mongoose' );
var info = require( '../package' );
var CSV = require( 'csv-stream' );

// Storage schema basic definiton
var Doc;
var storage = null;
var StorageSchema = new mongoose.Schema({});

// Constructor method
function BudaCSVAgent( conf ) {
  var self = this;
  var bag = [];

  BudaAgent.call( this, conf );

  // Log agent information
  self.log( 'Buda CSV Agent ver. ' + info.version );

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
  if( ! self.config.options ) {
    self.config.options = {};
  }
  this.parser = CSV.createStream( self.config.options );

  // Rewind on complete
  this.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      self.log( 'Inserting orphan bag' );
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
  this.parser.on( 'data', function( item ) {
    bag.push( self.transform( item ) );
    if( bag.length === ( self.config.storage.batch || 50 ) ) {
      self.log( 'Inserting bag' );
      Doc.collection.insert( bag, function( err ) {
        if( err ) {
          throw err;
        }
      });
      bag = [];
    }
  });

  // Log errors
  this.parser.on( 'error', function( err ) {
    throw err;
  });
}
util.inherits( BudaCSVAgent, BudaAgent );

// Disconnect from database on cleanup
BudaCSVAgent.prototype.cleanup = function() {
  this.log( 'Disconnect DB' );
  mongoose.disconnect();
};

module.exports = BudaCSVAgent;
