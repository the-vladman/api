// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var util = require( 'util' );
var JSONStream = require( 'JSONStream' );

// Constructor method
function BudaJSONAgent( conf, handlers ) {
  var self = this;
  var bag = [];

  BudaAgent.call( this, conf, handlers );

  // Configure data parser
  this.parser = JSONStream.parse( self.config.options.pointer );

  // Parser errors
  this.parser.on( 'error', function( err ) {
    self.emit( 'error', err );
  });

  // Rewind on complete
  this.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      self.emit( 'batch', bag );
      bag = [];
    }
  });

  // Process records
  this.parser.on( 'data', function( item ) {
    bag.push( item );
    if( bag.length === self.config.storage.batch ) {
      self.emit( 'batch', bag );
      bag = [];
    }
  });
}
util.inherits( BudaJSONAgent, BudaAgent );

module.exports = BudaJSONAgent;
