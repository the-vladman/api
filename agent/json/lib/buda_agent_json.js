// Enable strict syntax mode
'use strict';

// Base class
var BudaAgent = require( '../../buda_agent' );

// Custom requirements
var util = require( 'util' );
var JSONStream = require( 'JSONStream' );
var info = require( '../package' );

// Constructor method
function BudaJSONAgent( conf ) {
  var self = this;
  var bag = [];

  BudaAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda JSON Agent ver. ' + info.version );

  // Configure data parser
  self.parser = JSONStream.parse( self.config.options.pointer );

  // Parser errors
  self.parser.on( 'error', function( err ) {
    self.emit( 'error', err );
  });

  // Rewind on complete
  self.parser.on( 'end', function() {
    if( bag.length > 0 ) {
      self.emit( 'record', bag );
      bag = [];
    }
    self.log( 'Processing done!' );
  });

  // Process records
  self.parser.on( 'data', function( item ) {
    bag.push( item );
    if( bag.length === ( self.config.storage.batch || 50 ) ) {
      self.emit( 'record', bag );
      bag = [];
    }
  });
}
util.inherits( BudaJSONAgent, BudaAgent );

module.exports = BudaJSONAgent;
