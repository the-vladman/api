// Buda Agent Line
// ===============
// Base implementation for agents processing data line-by-line,
// custom implementations need only define the proper 'transform' method.
//
// function CustomLineAgent( conf ) {
//   BudaAgent.call( this, conf );
// }
// util.inherits( CustomLineAgent, BudaLineAgent );
//
// CustomLineAgent.prototype.transform = function( line ) {
//   /* Custom processing code here */
// };

// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( './buda_agent' );

// Custom requirements
var net = require( 'net' );
var util = require( 'util' );
var zlib = require( 'zlib' );
var byline = require( 'byline' );

// Constructor method
function BudaLineAgent( conf, handlers ) {
  BudaAgent.call( this, conf, handlers );
}
util.inherits( BudaLineAgent, BudaAgent );

// Empty tranform method, should be replaced on custom implementations
BudaLineAgent.prototype.transform = function( line ) {
  return { line: line };
};

// Custom start method
// This is required because of the way the flow is initiated
BudaLineAgent.prototype.start = function() {
  var self = this;
  var bag = [];
  var finalPass = false;
  var decompressor;

  // Connect to data storage using the parent implementation
  BudaLineAgent.super_.prototype.connectStorage.apply( this );

  // Create server
  this.incoming = net.createServer( function( socket ) {
    // Set up parser
    if( self.config.compression !== 'none' ) {
      // Create decompressor
      switch( self.config.compression ) {
        default:
        case 'gzip':
          decompressor = zlib.createGunzip();
          break;
      }

      self.parser = byline( socket.pipe( decompressor ), {
        end: false
      });
    } else {
      self.parser = byline( socket, {
        end: false
      });
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

    // Complete
    self.parser.on( 'end', function() {
      if( bag.length > 0 ) {
        self.emit( 'batch', bag );
        bag = [];
      }
    });

    // Process data
    self.parser.on( 'data', function( line ) {
      bag.push( self.transform( line.toString() ) );
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

module.exports = BudaLineAgent;
