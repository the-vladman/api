// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var _ = require( 'underscore' );
var util = require( 'util' );
var net = require( 'net' );
var info = require( '../package' );
var xmlflow = require( 'xml-flow' );

// Constructor method
function BudaXMLAgent( conf ) {
  BudaAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda XML Agent ver. ' + info.version );
}
util.inherits( BudaXMLAgent, BudaAgent );

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

  // Connect to data storage using the parent implementation
  BudaXMLAgent.super_.prototype.connectStorage.apply( this );

  // Create server
  self.incoming = net.createServer( _.bind( function( socket ) {
    // Set up parser
    if( self.config.compression !== 'none' ) {
      throw new Error( 'GZIP functionality not ready!' );
      // The decompressor closes the stream before the first iteration, passing
      // end: false is not working with the parser being used
      // self.parser = xmlflow( socket.pipe( self.decrompressor ), self.config.options );
    } else {
      self.parser = xmlflow( socket, self.config.options );
    }

    // Parser errors
    self.parser.on( 'error', function( err ) {
      throw err;
    });

    // Rewind on complete
    self.parser.on( 'end', function() {
      if( bag.length > 0 ) {
        self.model.collection.insert( bag, function( err ) {
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
      bag.push( self.transform( self.cleanItem( item ) ) );
      if( bag.length === ( self.config.storage.batch || 50 ) ) {
        self.model.collection.insert( bag, function( err ) {
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
