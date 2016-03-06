// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var util = require( 'util' );
var net = require( 'net' );
var zlib = require( 'zlib' );
var xmlflow = require( 'xml-flow' );

// Constructor method
function BudaXMLAgent( conf, handlers ) {
  BudaAgent.call( this, conf, handlers );
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
  var finalPass = false;
  var decompressor;

  // Connect to data storage using the parent implementation
  BudaXMLAgent.super_.prototype.connectStorage.apply( this );

  // Create server
  self.incoming = net.createServer( function( socket ) {
    // Set up parser
    if( self.config.compression !== 'none' ) {
      // Create decompressor
      switch( self.config.compression ) {
        default:
        case 'gzip':
          decompressor = zlib.createGunzip();
          break;
      }
      self.parser = xmlflow( socket.pipe( decompressor ), self.config.options );
    } else {
      self.parser = xmlflow( socket, self.config.options );
    }

    // Store records
    self.on( 'batch', function( data ) {
      // Increase counters
      self.currentState.batchCounter += 1;
      self.currentState.recordsCounter += bag.length;

      // Clear previous timer if any
      if( finalPass ) {
        clearTimeout( finalPass );
      } else {
        self.emit( 'flow:start', self.currentState );
      }

      // Setup final pass timer
      finalPass = setTimeout( function() {
        self.currentState.lastUpdate = new Date();
        self.parser.emit( 'end' );
        self.emit( 'flow:end', self.currentState );
        clearTimeout( finalPass );
      }, BudaAgent.UPDATE_PASS_LENGTH );

      // Store bag of records
      self.model.collection.insert( data, function( err ) {
        if( err ) {
          self.emit( 'error', err );
        }
      });
    });

    // Parser errors
    self.parser.on( 'error', function( err ) {
      self.emit( 'error', err );
    });

    // Rewind on complete
    self.parser.on( 'end', function() {
      if( bag.length > 0 ) {
        self.emit( 'batch', bag );
        bag = [];
      }
    });

    // Process records
    self.parser.on( 'tag:' + self.config.options.pointer, function( item ) {
      // Cleanup items
      bag.push( self.transform( self.cleanItem( item ) ) );
      if( bag.length === self.config.storage.batch ) {
        self.emit( 'batch', bag );
        bag = [];
      }
    });
  });

  // Start listening for data
  this.incoming.listen( this.endpoint, function() {
    self.emit( 'ready' );
  });
};

module.exports = BudaXMLAgent;
