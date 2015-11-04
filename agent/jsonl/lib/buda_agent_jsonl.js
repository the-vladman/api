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
  this.log( 'Buda JSONL Agent ver. ' + info.version );
}
util.inherits( BudaJSONLAgent, BudaLineAgent );

// Parse each line as a JSON object
BudaJSONLAgent.prototype.transform = function( line ) {
  return JSON.parse( line );
};

module.exports = BudaJSONLAgent;
