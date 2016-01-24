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
var byline = require( 'byline' );

// Constructor method
function BudaLineAgent( conf ) {
  BudaAgent.call( this, conf );
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

  // Connect to data storage using the parent implementation
  BudaLineAgent.super_.prototype.connectStorage.apply( this );

  // Create server
  this.incoming = net.createServer( function( socket ) {
    // Set up parser
    if( self.config.compression !== 'none' ) {
      throw new Error( 'GZIP functionality not ready!' );
      // The decompressor closes the stream before the first iteration, passing
      // end: false is not working with the parser being used
      // self.parser = byline( socket.pipe( self.decrompressor ), {
      //   end: false
      // });
    } else {
      self.parser = byline( socket, {
        end: false
      });
    }

    // Store records
    self.on( 'record', function( data ) {
      // Store bag of records
      self.model.collection.insert( data, function( err ) {
        if( err ) {
          throw err;
        }
      });
    });

    // Parser errors
    self.parser.on( 'error', function( err ) {
      throw err;
    });

    // Complete
    self.parser.on( 'end', function() {
      if( bag.length > 0 ) {
        self.emit( 'record', bag );
        bag = [];
      }
      self.log( 'Processing done!' );
    });

    self.parser.on( 'data', function( line ) {
      bag.push( self.transform( line.toString() ) );
      if( bag.length === ( self.config.storage.batch || 5 ) ) {
        self.emit( 'record', bag );
        bag = [];
      }
    });
  });

  // Start listening for data
  this.incoming.listen( this.endpoint, function() {
    self.log( 'Agent ready' );
  });
};

module.exports = BudaLineAgent;
