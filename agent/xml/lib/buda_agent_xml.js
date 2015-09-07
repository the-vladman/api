// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var _ = require( 'underscore' );
var util = require( 'util' );
var net = require( 'net' );
var mongoose = require( 'mongoose' );
var info = require( '../package' );
var xmlflow = require( 'xml-flow' );

// Storage schema basic definiton
var Doc;
var storage = null;
var StorageSchema = new mongoose.Schema({});

// Constructor method
function BudaXMLAgent( conf ) {
  BudaAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda XML Agent ver. ' + info.version );

  // Configure schema and model for storage
  StorageSchema.set( 'strict', false );
  StorageSchema.set( 'collection', this.config.storage.collection );
  Doc = mongoose.model( 'Doc', StorageSchema );

  // Connect to DB
  // The storage host will be collected from ENV and override as config parameter
  if( process.env.STORAGE_PORT ) {
    storage = process.env.STORAGE_PORT.replace( 'tcp://', '' );
  }
  if( this.config.storage.host ) {
    storage = this.config.storage.host;
  }

  // No storage located? exit with error
  if( ! storage ) {
    throw new Error( 'No storage available' );
  }

  // Append selected DB and connect
  storage += '/' + this.config.storage.db;
  mongoose.connect( 'mongodb://' + storage );
}
util.inherits( BudaXMLAgent, BudaAgent );

// Disconnect from database on cleanup
BudaXMLAgent.prototype.cleanup = function() {
  this.log( 'Disconnect DB' );
  mongoose.disconnect();
};

// Perform cleanup on items before storage
BudaXMLAgent.prototype.cleanItem = function( item ) {
  var string = JSON.stringify( item )
                   .replace( /\$attrs/g, '_attrs' )
                   .replace( /\$name/g, '_name' )
                   .replace( /\$text/g, '_text' );

  return JSON.parse( string );
};

// Custom start method
// This is required because of the way the flow is initiated
BudaXMLAgent.prototype.start = function() {
  var self = this;
  var bag = [];
  var clean;

  // Create server
  this.incoming = net.createServer( _.bind( function( socket ) {
    // Configure xml flow
    self.parser = xmlflow( socket, self.config.options );

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
    self.parser.on( 'tag:' + self.config.options.pointer, function( item ) {
      // Cleanup items
      clean = self.transform( self.cleanItem( item ) );
      bag.push( clean );
      if( bag.length === ( self.config.storage.batch || 50 ) ) {
        Doc.collection.insert( bag, function( err ) {
          if( err ) {
            throw err;
          }
        });
        bag = [];
      }
    });
  }, this ) );

  // Start listening for data
  this.incoming.listen( this.endpoint, function() {
    self.log( 'Agent ready' );
  });
};

module.exports = BudaXMLAgent;
