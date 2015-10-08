/* eslint no-sync:0, no-process-exit:0 */
// Buda Manager
// ============
// Handle a graph of subprocesses for data manipulation on
// specific zones and provides a REST interface for management.
//
// Available commands:
//    getZoneList        GET /
//    getZoneDetails     GET /{id}
//    updateZone         PUT /{id}
//    updateZone         PATCH /{id}
//    deleteZone         DELETE /{id}
//    registerZone       POST /
//    ping               GET /ping

// Enable strict syntax mode
'use strict';

// Load required modules
var _ = require( 'underscore' );
var fs = require( 'fs' );
var path = require( 'path' );
var Hapi = require( 'hapi' );
var crypto = require( 'crypto' );
var spawn = require( 'child_process' ).spawn;
var execSync = require( 'child_process' ).execSync;
var info = require( '../package' );
var colors = require( 'colors/safe' );
var bunyan = require( 'bunyan' );
var jsen = require( 'jsen' );
var mongoose = require( 'mongoose' );
var YAML = require( 'yamljs' );

// Storage elements
var ZoneStorageSchema = new mongoose.Schema({});
var ZoneModel;

// Utility method to calculate a zone ID
function getID( zone ) {
  var shasum = crypto.createHash( 'sha1' );
  var digest = '|';

  digest += zone.version + '|';
  digest += zone.metadata.title + '|';
  digest += zone.metadata.description + '|';
  digest += zone.metadata.organization + '|';
  digest += zone.data.format + '|';
  digest += zone.data.storage.collection + '|';
  digest += zone.data.hotspot.type + '|';

  shasum.update( digest );
  return shasum.digest( 'hex' );
}

// Constructor method
function BudaManager( params ) {
  // Runtime agents list
  this.agents = {};

  // Runtime configuration holder
  this.config = _.defaults( params, BudaManager.DEFAULTS );

  // JSON schemas used
  this.schemas = {};

  // App logging interface
  this.logger = bunyan.createLogger({
    name:   'buda-manager',
    stream: process.stdout,
    level:  'debug'
  });

  // API interface
  this.restapi = new Hapi.Server({
    minimal: true,
    load:    {
      sampleInterval: 5000
    }
  });
}

// Default config values
// - storage: MongoDB instance used for data storage
// - home: This directory must be readable and writable by the user
//   starting the daemon.
// - port: Main TCP port used to wait for commands using the API,
//   only 'root' can bind to ports lower than 1024 but running this
//   process as a privileged user is not advised ( nor required )
// - docker: If set, launch agents as docker containers instead of
//   child processes
// - range: Inclusive range of TCP ports to use for agents
BudaManager.DEFAULTS = {
  home:    '/var/run/buda',
  port:    8100,
  docker:  false,
  range:   '2810-2890',
  storage: 'localhost:27017/buda'
};

// Apply verifications to the home/working directory
BudaManager.prototype._verifyHome = function() {
  this.logger.debug( 'Check home directory exist' );

  try {
    if( ! fs.statSync( this.config.home ).isDirectory() ) {
      throw new Error( 'Home directory does not exist' );
    }
  } catch( e ) {
    this.logger.fatal( 'Home directory does not exist' );
    process.exit();
  }

  this.logger.debug( 'Check home directory is readable and writeable' );
  try {
    fs.accessSync( this.config.home, fs.R_OK | fs.W_OK );
  } catch( err ) {
    this.logger.fatal( err, 'Invalid permissions' );
    process.exit();
  }
};

// Setup REST interface
BudaManager.prototype._startInterface = function() {
  var self = this;

  // Config connection socket
  this.restapi.connection({
    host: '0.0.0.0',
    port: this.config.port
  });

  // Attach REST routes to commands
  this.restapi.route( [
    {
      method:  'GET',
      path:    '/ping',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Healt check' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        reply( 'pong' );
      }
    },
    {
      method:  'GET',
      path:    '/',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Retrieve zone list' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        self._getZoneList( function( res ) {
          reply( res );
        });
      }
    },
    {
      method:  'GET',
      path:    '/{id}',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Retrieve zone details' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        self._getZoneDetails( request.params.id, function( res ) {
          reply( res );
        });
      }
    },
    {
      method:  'PUT',
      path:    '/{id}',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Update zone' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );

        // Parse zone declaration if using YAML format
        if( request.payload.format && request.payload.format === 'yaml' ) {
          request.payload.zone = YAML.parse( request.payload.zone );
        }

        self._updateZone( request.params.id, request.payload.zone, function( res ) {
          reply( res );
        });
      }
    },
    {
      method:  'PATCH',
      path:    '/{id}',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Update zone' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );

        // Parse zone declaration if using YAML format
        if( request.payload.format && request.payload.format === 'yaml' ) {
          request.payload.zone = YAML.parse( request.payload.zone );
        }

        self._updateZone( request.params.id, request.payload.zone, function( res ) {
          reply( res );
        });
      }
    },
    {
      method:  'DELETE',
      path:    '/{id}',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Delete zone' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        self._deleteZone( request.params.id, function( res ) {
          reply( res );
        });
      }
    },
    {
      method:  'POST',
      path:    '/',
      handler: function( request, reply ) {
        self.logger.info( 'Request: Create zone' );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );

        // Parse zone declaration if using YAML format
        if( request.payload.format && request.payload.format === 'yaml' ) {
          request.payload.zone = YAML.parse( request.payload.zone );
        }

        self._registerZone( request.payload.zone, function( res ) {
          reply( res );
        });
      }
    },
    {
      method:  '*',
      path:    '/{p*}',
      handler: function( request, reply ) {
        self.logger.warn( 'Bad request: %s %s', request.method, request.path );
        self.logger.debug({
          params:  request.params,
          headers: request.headers
        }, 'Request details' );
        reply({
          error: true,
          desc:  'INVALID_REQUEST'
        });
      }
    }
  ] );

  // Open connections
  this.restapi.start();
};

// Starts a new zone agent
/* eslint complexity:0 */
BudaManager.prototype._startAgent = function( zone ) {
  var self = this;
  var cmd;
  var seed;
  var agent;
  var portsRange;

  // Start agent as a container if running in 'docker' mode
  if( self.config.docker ) {
    // Set default port to the one exposed on the docker image; it will
    // be dynamically mapped on launch
    if( zone.data.hotspot.type === 'tcp' && ! zone.data.hotspot.location ) {
      zone.data.hotspot.location = 8200;
    }

    // Create docker launch command
    cmd = 'docker run -dP --name ' + zone.data.storage.collection + ' ';
    if( zone.extras.docker.links ) {
      _.each( zone.extras.docker.links, function( el ) {
        cmd += '--link ' + el + ' ';
      });
    }
    cmd += zone.extras.docker.image + ' ';
    cmd += "--conf '" + JSON.stringify( zone.data ) + "'";

    // Start container and use the hash returned as ID
    agent = execSync( cmd ).toString().substr( 0, 12 );
    self.logger.info( 'Starting container agent: %s', agent );
    self.logger.debug({
      configuration: zone.data,
      cmd:           cmd
    }, 'Starting container agent: %s', agent );

    self.agents[ zone.extras.id ] = agent;
    return;
  }

  // Start agent as a sub-process
  // Randomly find a port in the provided range if required
  if( zone.data.hotspot.type === 'tcp' && ! zone.data.hotspot.location ) {
    portsRange = this.config.range.split( '-' );
    portsRange[ 0 ] = Number( portsRange[ 0 ] );
    portsRange[ 1 ] = Number( portsRange[ 1 ] );
    seed = Math.random() * ( portsRange[ 1 ] - portsRange[ 0 ] ) + portsRange[ 0 ];
    zone.data.hotspot.location = Math.floor( seed );
  }

  // Sub-process setup
  cmd = 'buda-agent-' + zone.data.format;
  if( zone.extras.handler ) {
    cmd = zone.extras.handler;
  }

  // Create agent
  agent = spawn( cmd, ['--conf', JSON.stringify( zone.data ) ] );
  self.logger.info( 'Starting agent: %s', agent.pid );
  self.logger.debug({
    configuration: zone.data,
    cmd:           cmd
  }, 'Starting agent: %s', agent.pid );

  // Add agent and attach process PID to the zone
  self.agents[ zone.extras.id ] = agent.pid;

  // Catch information on the agent output
  agent.stdout.on( 'data', function( msg ) {
    try {
      self.logger.debug( msg.toString() );
    } catch( e ) {
      self.logger.error( e );
    }
  });
};

// Stops a given zone agent
BudaManager.prototype._stopAgent = function( zone ) {
  var self = this;

  // Kill agent
  if( self.config.docker ) {
    self.logger.debug( 'Stopping container agent: %s', self.agents[ zone.extras.id ] );
    execSync( 'docker rm -f ' + self.agents[ zone.extras.id ] );
  } else {
    self.logger.debug( 'Stopping process agent: %s', self.agents[ zone.extras.id ] );
    process.kill( self.agents[ zone.extras.id ], 'SIGTERM' );
  }
};

// Retrive a list of all zones in play
BudaManager.prototype._getZoneList = function( cb ) {
  var self = this;

  ZoneModel.find({}, { _id: 0 }, function( err, res ) {
    if( err ) {
      self.logger.error( err );
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }
    cb( res );
  });
};

// Retrieve details of a specific zone
BudaManager.prototype._getZoneDetails = function( id, cb ) {
  var self = this;

  // Retrieve element based on it's id
  ZoneModel.find({ 'extras.id': id }, { _id: 0 }, function( err, res ) {
    if( err ) {
      self.logger.error( err );
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }

    if( res.length !== 1 ) {
      self.logger.warn( 'Invalid zone id: %s', id );
      return cb({ error: true, desc: 'INVALID_ZONE_ID' });
    }

    return cb( res[ 0 ] );
  });
};

// Update and existing zone
BudaManager.prototype._updateZone = function( id, newData, cb ) {
  var self = this;

  // Delete existing zone
  self._deleteZone( id, function( res ) {
    if( res.error ) {
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }

    // Create new zone
    self._registerZone( newData, function( zone ) {
      if( zone.error ) {
        return cb({ error: true, desc: 'INTERNAL_ERROR' });
      }
      cb( zone );
    });
  });
};

// Delete a running zone
BudaManager.prototype._deleteZone = function( id, cb ) {
  var self = this;

  ZoneModel.where({ 'extras.id': id }).findOneAndRemove( function( err, res ) {
    // Delete error
    if( err ) {
      self.logger.error( err );
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }

    // Invalid ID
    if( ! res ) {
      self.logger.warn( 'Invalid zone id: %s', id );
      return cb({ error: true, desc: 'INVALID_ZONE_ID' });
    }

    // Stop zone agent and return
    self._stopAgent( res._doc );
    return cb( res._doc );
  });
};

// Register a new zone
BudaManager.prototype._registerZone = function( zone, cb ) {
  // Validation function holder
  var zoneValidation;
  var self = this;

  // Check zone details are present
  if( ! zone ) {
    this.logger.warn( 'Missing parameters' );
    return { error: true, desc: 'MISSING_PARAMETERS' };
  }

  // Not supported schema version?
  if( ! this.schemas[ 'zone-' + zone.version ] ) {
    this.logger.error( 'Unsupported schema version' );
    return { error: true, desc: 'UNSUPPORTED_SCHEMA_VERSION' };
  }

  // Validate zone against the schema version used
  zoneValidation = jsen( JSON.parse( this.schemas[ 'zone-' + zone.version ] ) );
  if( ! zoneValidation( zone ) ) {
    this.logger.error({ errors: zoneValidation.errors }, 'Invalid zone definition' );
    return {
      error:   true,
      desc:    'INVALID_ZONE_DEFINITION',
      details: zoneValidation.errors
    };
  }

  // Set dates
  zone.metadata.issued = new Date( zone.metadata.issued || Date.now() );
  zone.metadata.modified = new Date( zone.metadata.modified || Date.now() );

  // Calculate ID
  zone.extras.id = getID( zone );

  // Start zone agent
  this._startAgent( zone );

  // Store zone record
  ZoneModel.collection.insert( zone, function( err ) {
    if( err ) {
      self.logger.error( err );
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }

    delete zone._id;
    cb( zone );
  });
};

// Show usage information
BudaManager.prototype.printHelp = function() {
  console.log( colors.green.bold( 'Buda Manager ver. ' + info.version ) );
  console.log( colors.white.bold( 'Available configuration options are:' ) );
  _.each( BudaManager.DEFAULTS, function( val, key ) {
    console.log( colors.gray( '\t' + key + '\t' + val ) );
  });
};

// Gracefully shutdown
BudaManager.prototype.exit = function() {
  var self = this;

  // Get existing zones
  self._getZoneList( function( list ) {
    // Close storage connection
    mongoose.connection.close( function() {
      // Stop running agents
      self.logger.info( 'Storage disconnected' );
      self.logger.info( 'Stopping running agents' );
      if( list.length > 0 ) {
        _.each( list, function( zone ) {
          self._stopAgent( zone._doc );
        });
      }
      self.logger.info( 'Exiting Manager' );
      process.exit();
    });
  });
};

// Kickstart for the daemon process
BudaManager.prototype.start = function() {
  var self = this;
  var schemaFiles;

  // Looking for help ?
  if( _.has( self.config, 'h' ) || _.has( self.config, 'help' ) ) {
    self.printHelp();
    process.exit();
  }

  // Log config
  self.logger.info( 'Buda Manager ver. ' + info.version );
  self.logger.debug({
    config: self.config
  }, 'Starting with configuration' );

  // Storage connection
  ZoneStorageSchema.set( 'strict', false );
  ZoneStorageSchema.set( 'collection', 'sys.zones' );
  ZoneModel = mongoose.model( 'Doc', ZoneStorageSchema );
  self.logger.info( 'Connecting to storage: ' + self.config.storage );
  mongoose.connect( 'mongodb://' + self.config.storage, {
    server: {
      socketOptions: {
        keepAlive:        1,
        connectTimeoutMS: 5000
      }
    }
  });
  mongoose.connection.on( 'error', function( err ) {
    self.logger.fatal( err );
    process.exit();
  });

  // Load schemas
  self.logger.info( 'Loading schemas' );
  schemaFiles = fs.readdirSync( path.join( __dirname, '../schemas' ) );
  _.each( schemaFiles, function( el ) {
    var name = path.basename( el, '.json' );
    var file;

    if( name.charAt( 0 ) !== '.' ) {
      self.logger.debug( name );
      file = path.join( __dirname, '../schemas/', el );
      self.schemas[ name ] = fs.readFileSync( file ).toString();
    }
  });

  // Home directory validations
  self.logger.info( 'Verifying working directory' );
  self._verifyHome();

  // Move process to working directory
  self.logger.info( 'Moving process to working directory' );
  process.chdir( self.config.home );

  // Start REST interface
  self.logger.info( 'Starting REST interface' );
  self._startInterface();
  self.logger.debug({
    config: self.restapi.info
  }, 'Interface started with configuration' );

  // Re-start agents from any existing zones
  self.logger.info( 'Restarting existing agents' );
  self._getZoneList( function( list ) {
    _.each( list, function( zone ) {
      self.logger.info( 'Starting agent for zone: ' + zone._doc.extras.id );
      self._startAgent( zone._doc );
    });
  });

  // Log final output
  self.logger.info( 'Initialization process complete' );

  // Listen for interruptions and gracefully shutdown
  process.stdin.resume();
  process.on( 'SIGINT', _.bind( this.exit, this ) );
  process.on( 'SIGTERM', _.bind( this.exit, this ) );
};

module.exports = BudaManager;
