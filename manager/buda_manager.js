// Buda Manager
// ============
// Handle a graph of subprocesses for data manipulation on
// specific zones and provides a REST interface for management.
//
// Available commands:
//    getZoneList        GET /
//    getZoneDetails     GET /{id}
//    getZoneLog         GET /{id}/log
//    updateZone         PUT /{id}
//    updateZone         PATCH /{id}
//    deleteZone         DELETE /{id}
//    registerZone       POST /
//    ping               GET /ping

// Enable strict syntax mode
'use strict';

// Load required modules
var _        = require( 'underscore' );
var Hapi     = require( 'hapi' );
var spawn    = require( 'child_process' ).spawn;
var minimist = require( 'minimist' );
var colors   = require( 'colors/safe' );
var info     = require( './package' );

// Utility method to output style-rich and uniform messages
function log( msg, bold, color ) {
  var style = color || 'white';
  if( bold ) {
    process.stdout.write( colors[style].bold( '===> ' + msg ) );
  } else {
    process.stdout.write( colors[style]( '     ' + msg ) );
  }
  process.stdout.write( '\n' );
}

// Constructor method
function BudaManager() {
  // Runtime zones list
  this.zones = [];
  
  // Runtime configuration holder
  this.config = {};
  
  // API interface
  this.restapi = new Hapi.Server();
  
  // Default config values
  // - The 'home' directory must be readable and writable by the user
  //   starting the daemon.
  // - Only 'root' can bind to ports lower than 1024 but running this
  //   process as a privileged user is not advaised ( or required )
  this.DEFAULTS = {
    home: '/home/buda/',
    port: 8000,
    list: 'zones.conf'
  };
}

// Determine runtime configuration: defaults | ENV | CLI
BudaManager.prototype._loadConfig = function() {
  var config = this.DEFAULTS;
  _.each( this.DEFAULTS, function( val, key ) {
    if( process.env[ 'BUDA_MANAGER_' + key.toUpperCase() ] ) {
      config[ key ] = process.env[ 'BUDA_MANAGER_' + key.toUpperCase() ];
    }
  });
  config = minimist( process.argv.slice( 2 ), { 'default': config });
  delete config._;
  
  this.config = config;
};

// Setup REST interface
BudaManager.prototype._setupInterface = function() {
  var self = this;
  
  // Config connection socket
  this.restapi.connection({
    host: 'localhost', 
    port: this.config.port
  });
  
  this.restapi.route({
    method: 'GET',
    path:'/ping', 
    handler: function( request, reply ) {
      log( 'Health check', true, 'gray' );
      reply( 'pong' );
    }
  });
  
  this.restapi.route({
    method: 'GET',
    path:'/', 
    handler: function( request, reply ) {
      reply( self._getZoneList() );
    }
  });
  
  this.restapi.route({
    method: 'GET',
    path:'/{id}', 
    handler: function( request, reply ) {
      reply( self._getZoneDetails( request.params.id ) );
    }
  });
  
  this.restapi.route({
    method: 'GET',
    path:'/{id}/log', 
    handler: function( request, reply ) {
      reply( self._getZoneLog( request.params.id ) );
    }
  });
  
  this.restapi.route({
    method: 'PUT',
    path:'/{id}', 
    handler: function( request, reply ) {
      reply( self._updateZone( request.params.id ) );
    }
  });
  
  this.restapi.route({
    method: 'PATCH',
    path:'/{id}', 
    handler: function( request, reply ) {
      reply( self._updateZone( request.params.id ) );
    }
  });
  
  this.restapi.route({
    method: 'DELETE',
    path:'/{id}', 
    handler: function( request, reply ) {
      reply( self._deleteZone( request.params.id ) );
    }
  });
  
  this.restapi.route({
    method: 'POST',
    path:'/', 
    handler: function( request, reply ) {
      reply( self._registerZone() );
    }
  });
};

// Retrive a list of all zones in play
BudaManager.prototype._getZoneList = function() {
  log( 'Retrieving zones list', true );
  
  log( 'List retrieved', true, 'green' );
  return this.zones;
};

// Retrieve details of a specific zone
BudaManager.prototype._getZoneDetails = function( id ) {
  log( 'Retrieving details for zone: ' + id, true );
  
  // Retrieve element from this.zones based on it's id
  log( 'Validating zone id', false, 'gray' );
  
  log( 'Details retrieved', true, 'green' );
  return 'details for: ' + id;
};

// Retrieve output available for a specific zone
BudaManager.prototype._getZoneLog = function( id ) {
  log( 'Retrieving logs for zone: ' + id, true );
  
  // Retrieve element from this.zones based on it's id
  log( 'Validating zone id', false, 'gray' );
  
  // Get stdout of it's agent and return
  log( 'Getting agent output', false, 'gray' );
  
  log( 'Logs retrieved', true, 'green' );
  return 'log for: ' + id;
};

BudaManager.prototype._updateZone = function( id ) {
  log( 'Updating zone: ' + id, true );
  
  // Retrieve element from this.zones based on it's id
  log( 'Validating zone id', false, 'gray' );
  
  // Stop zone agent
  log( 'Stopping zone agent', false, 'gray' );
  
  // Replace and reattach
  log( 'Reattaching updated zone', false, 'gray' );
  
  // Update list on disk
  log( 'Updating zone list', false, 'gray' );
  
  // Return new details
  log( 'Zone updated', true, 'green' );
  return 'updating: ' + id;
};

BudaManager.prototype._deleteZone = function( id ) {
  log( 'Deleting zone: ' + id, true );
  
  // Retrieve element from this.zones based on it's id
  
  // Stop zone agent
  log( 'Stopping zone agent', false, 'gray' );
  
  // Remove
  log( 'Removing zone', false, 'gray' );
  
  // Update list on disk
  log( 'Updating zone list', false, 'gray' );
  
  log( 'Zone deleted', true, 'green' );
  return 'deleting: ' + id;
};

BudaManager.prototype._registerZone = function() {
  log( 'Registering new zone', true );
  
  // Validate zone details
  log( 'Validating zone details', false, 'gray' );
  
  // Calculate ID
  log( 'New zone ID: ', false, 'gray' );
  
  // Spawn agent based on zone.data.type
  log( 'New zone agent: ', false, 'gray' );
  
  // Add zone to the list
  log( 'Attach new zone', false, 'gray' );
  
  // Update list on disk
  log( 'Updating zone list', false, 'gray' );
  
  // Return new zone details
  
  log( 'Zone created', true, 'green' );
  return 'zone created';
};

// Show usage information
BudaManager.prototype.printHelp = function() {
  log( 'Usage information', true, 'gray' );
  log( 'Available configuration options are:', false, 'gray' );
  _.each( this.DEFAULTS, function( val, key ) {
    log( key + '\t' + val, false, 'gray' );
  });
};

// Kickstart for the daemon process
BudaManager.prototype.start = function() {
  log( 'Buda Manager ver. ' + info.version, true );
  
  // Get configuration to use
  this._loadConfig();
  
  // Looking for help ?
  if( _.has( this.config, 'h' ) || _.has( this.config, 'help' ) ) {
    this.printHelp();
    process.exit();
  }
  
  log( 'Starting with parameters', true );
  _.each( this.config, function( val, key ) {
    log( key + ': ' + val );
  });
  
  // Move process to working directory
  log( 'Moving process to working directory', true );
  process.chdir( this.config.home );
  
  // Setup REST interface
  this._setupInterface();
  
  // Start REST interface
  log( 'Starting REST interface', true );
  this.restapi.start();
  log( 'Waiting for requests on port: ' + this.config.port );
  log( 'Initialization process complete', true );
};

module.exports = BudaManager;