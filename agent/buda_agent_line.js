// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( './buda_agent' );

// Custom requirements
var _ = require( 'underscore' );
var net = require( 'net' );
var util = require( 'util' );
var mongoose = require( 'mongoose' );
var byline = require( 'byline' );

// Storage schema basic definiton
var Doc;
var storage = null;
var StorageSchema = new mongoose.Schema({});

// Constructor method
function BudaLineAgent( conf ) {
  var self = this;

  BudaAgent.call( this, conf );

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
}
util.inherits( BudaLineAgent, BudaAgent );

// Disconnect from database on cleanup
BudaLineAgent.prototype.cleanup = function() {
  this.log( 'Disconnect DB' );
  mongoose.disconnect();
};

// Empty tranform method, should be replaced on custom implementations
BudaLineAgent.prototype.transform = function( line ) {
  return { line: line };
};

// Custom start method
// This is required because of the way the flow is initiated
BudaLineAgent.prototype.start = function() {
  var self = this;
  var bag = [];

  // Create server
  this.incoming = net.createServer( _.bind( function( socket ) {
    // Set up parser
    if( self.config.compression !== 'none' ) {
      self.parser = byline( socket.pipe( self.decrompressor, { end: false }), {
        end: false
      });
    } else {
      self.parser = byline( socket, {
        end: false
      });
    }

    // Parser errors
    self.parser.on( 'error', function( err ) {
      throw err;
    });

    // Complete
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

    self.parser.on( 'data', function( line ) {
      bag.push( self.transform( line.toString() ) );
      if( bag.length === ( self.config.storage.batch || 5 ) ) {
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

module.exports = BudaLineAgent;
