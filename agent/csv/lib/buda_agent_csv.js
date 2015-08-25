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
var StorageSchema = new mongoose.Schema({});
var Doc;
var storage = '';

// Constructor method
function BudaCSVAgent( conf ) {
  var self = this;
  var bag = [];

  BudaAgent.call( this, conf );

  // Log agent information
  self.log( 'Buda CSV Agent ver. ' + info.version );

  // Configure schema and model for storage
  StorageSchema.set( 'strict', false );
  StorageSchema.set( 'collection', this.config.storage.collection );
  Doc = mongoose.model( 'Doc', StorageSchema );

  // Connect to DB
  // If we're running inside a container some ENV variables should be
  // set, otherwise assume is a local run and fallback to localhost storage
  if( process.env.STORAGE_PORT ) {
    storage += process.env.STORAGE_PORT.replace( 'tcp://', '' );
  } else {
    storage += 'localhost:27017';
  }
  storage += '/' + this.config.storage.db;
  mongoose.connect( 'mongodb://' + storage );

  // Configure data parser
  this.parser = CSV.createStream({
    delimiter:    this.config.data.separator,
    escapeChar:   '"',
    enclosedChar: '"'
  });

  // Rewind on complete
  this.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      self.log( 'Inserting orphan bag' );
      Doc.collection.insert( bag, function( err ) {
        if( err ) {
          self.log( 'Storage error', 'error', err );
        }
      });
      bag = [];
    }
    self.log( 'Processing done!' );
  });

  // Process records
  this.parser.on( 'data', function( item ) {
    bag.push( item );
    if( bag.length === ( self.config.storage.batch || 50 ) ) {
      self.log( 'Inserting bag' );
      Doc.collection.insert( bag, function( err ) {
        if( err ) {
          self.log( 'Storage error', 'error', item );
        }
      });
      bag = [];
    }
  });

  // Log errors
  this.parser.on( 'error', function( err ) {
    self.log( err );
  });
}
util.inherits( BudaCSVAgent, BudaAgent );

// Disconnect from database on cleanup
BudaCSVAgent.prototype.cleanup = function() {
  this.log( 'Disconnect DB' );
  mongoose.disconnect();
};

module.exports = BudaCSVAgent;
