// Enable strict syntax mode
'use strict';

// Base class
var BudaLineAgent = require( '../../buda_agent_line' );

// Custom requirements
var util = require( 'util' );
var info = require( '../package' );

// Constructor method
function BudaJSONLAgent( conf ) {
  BudaLineAgent.call( this, conf );

  // Log agent information
  this.log( 'Buda JSONL Agent ver. ' + info.version );
}
util.inherits( BudaJSONLAgent, BudaLineAgent );

BudaJSONLAgent.prototype.transform = function( line ) {
  return JSON.parse( line );
};

module.exports = BudaJSONLAgent;
