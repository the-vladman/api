/* eslint no-sync:0 */
// Buda Manager
// ============
// Handle a graph of subprocesses for data manipulation on
// specific datasets and provides a REST interface for management.
//
// Available commands:
//    getDatasetList        GET /
//    getDatasetDetails     GET /{id}
//    updateDataset         PUT /{id}
//    updateDataset         PATCH /{id}
//    deleteDataset         DELETE /{id}
//    registerDataset       POST /
//    ping                  GET /ping

// Enable strict syntax mode
'use strict';

// Load required modules
var _ = require( 'underscore' );
var fs = require( 'fs' );
var os = require( 'os' );
var events = require( 'events' );
var util = require( 'util' );
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
var async = require( 'async' );
var openssl = require( 'openssl-wrapper' );

// Storage elements
var DatasetStorageSchema = new mongoose.Schema({});
var DatasetModel;

// Utility method to calculate a dataset ID
function _getID( dataset ) {
  var shasum = crypto.createHash( 'sha256' );
  var digest = '|';

  digest += dataset.version + '|';
  digest += dataset.metadata.title + '|';
  digest += dataset.metadata.description + '|';
  digest += dataset.metadata.organization + '|';
  digest += dataset.data.format + '|';
  digest += dataset.data.storage.collection + '|';
  digest += dataset.data.hotspot.type + '|';

  shasum.update( digest );
  return shasum.digest( 'hex' );
}

// Utility method, starts dataset agent as a Docker container
function _startContainer( dataset ) {
  var cmd;
  var agent;

  // Set default port to the one exposed on the docker image; it will
  // be dynamically mapped on launch
  if( dataset.data.hotspot.type === 'tcp' ) {
    dataset.data.hotspot.location = 8200;
  }

  // Create docker launch command
  cmd = 'docker run -dP --name ' + dataset.data.storage.collection + ' ';
  cmd += '--log-opt max-size=20m ';
  cmd += '--log-opt max-file=5 ';
  if( dataset.extras.docker.links ) {
    _.each( dataset.extras.docker.links, function( el ) {
      cmd += '--link ' + el + ' ';
    });
  }
  cmd += dataset.extras.docker.image + ' ';
  cmd += "--conf '" + JSON.stringify( dataset.data ) + "'";

  // Start container and use the hash returned as ID
  agent = execSync( cmd ).toString().substr( 0, 12 );

  // Get container port mapping
  cmd = 'docker inspect ';
  cmd += '-f=\'{{(index (index .NetworkSettings.Ports "8200/tcp") 0).HostPort}}\' ';
  dataset.data.hotspot.location = execSync( cmd + agent ).toString().trim();
  return agent;
}

// Utility method, starts dataset agent as a subprocess
function _startSubProcess( dataset, config ) {
  var cmd;
  var agent;
  var seed;
  var portsRange;

  // Start agent as a sub-process
  switch( dataset.data.hotspot.type ) {
    case 'unix':
      dataset.data.hotspot.location = path.join( config.home, dataset.extras.id );
      break;
    case 'tcp':
    default:
      // Randomly find a port in the provided range if required
      if( ! dataset.data.hotspot.location ) {
        portsRange = config.range.split( '-' );
        portsRange[ 0 ] = Number( portsRange[ 0 ] );
        portsRange[ 1 ] = Number( portsRange[ 1 ] );
        seed = Math.random() * ( portsRange[ 1 ] - portsRange[ 0 ] ) + portsRange[ 0 ];
        dataset.data.hotspot.location = Math.floor( seed );
      }
  }

  // Sub-process setup
  cmd = dataset.extras.handler || 'buda-agent-' + dataset.data.format;

  // Create agent
  agent = spawn( cmd, ['--conf', JSON.stringify( dataset.data ) ] );
  return agent;
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
    load: {
      sampleInterval: 5000
    }
  });
}

// Add event emitter capabilities
util.inherits( BudaManager, events.EventEmitter );

// Default config values
// - home: This directory must be readable and writable by the user starting
//   the daemon
// - port: Main TCP port used to wait for commands using the API,
//   only 'root' can bind to ports lower than 1024 but running this
//   process as a privileged user is not advised ( nor required )
// - docker: If set, launch agents as docker containers instead of child
//   processes
// - range: Inclusive range of TCP ports to use for agents
// - storage: MongoDB instance used for data storage
// - ca: If set to a valid CA x509 certificate ( PEM format ) the process
//   will run in 'secure' mode; in this setup all operations will require
//   a valid client certificate signed by the CA; the client cert must be
//   provided in PEM format/base64 encoded using the HTTP header X-BUDA-Client
BudaManager.DEFAULTS = {
  home:    '/var/run',
  port:    8100,
  docker:  false,
  range:   '2810-2890',
  storage: 'localhost:27017/buda',
  ca:      false
};

// Apply verifications to the home/working directory
BudaManager.prototype._verifyHome = function() {
  this.logger.debug( 'Check home directory exist' );

  try {
    if( ! fs.statSync( this.config.home ).isDirectory() ) {
      throw new Error( 'Home directory does not exist' );
    }
  } catch( err ) {
    this.logger.fatal( 'Home directory does not exist' );
    this.emit( 'error', err );
  }

  this.logger.debug( 'Check home directory is readable and writeable' );
  try {
    fs.accessSync( this.config.home, fs.R_OK | fs.W_OK );
  } catch( err ) {
    this.logger.fatal( err, 'Invalid permissions' );
    this.emit( 'error', err );
  }
};

// Validate the provided CA to run in secure mode
BudaManager.prototype._validateCA = function() {
  var self = this;

  self.logger.debug( 'Check CA file exists and is accesible' );
  try {
    fs.accessSync( self.config.ca, fs.R_OK );
  } catch( err ) {
    self.logger.fatal( err, 'Invalid permissions' );
    self.emit( 'error', err );
  }

  // openssl x509 -in FILE -noout -purpose
  self.logger.debug( 'Check CA is a valid certificate' );
  openssl.exec( 'x509', {
    in:      self.config.ca,
    noout:   true,
    purpose: true
  }, function( err, res ) {
    if( err ) {
      self.emit( 'error', err );
    }
    if( res.toString().indexOf( 'SSL client CA : Yes' ) === - 1 ) {
      self.logger.fatal( err, 'Invalid CA file' );
      self.emit( 'error', new Error( 'Invalid CA file' ) );
    }
  });
};

// Validate the provided client certificate
BudaManager.prototype._validateClientCert = function( data, cb ) {
  var self = this;
  var md5 = crypto.createHash( 'md5' );
  var cert = new Buffer( data, 'base64' ).toString();
  var dates = [];
  var tmp;

  // Insecure mode? Do nothing!
  if( ! self.config.ca ) {
    return cb( null );
  }

  // Write cert to tmp file
  md5.update( cert );
  tmp = md5.digest( 'hex' );
  fs.writeFileSync( path.join( os.tmpdir(), tmp ), cert );

  async.waterfall( [
    // Validate cert
    // openssl x509 -in client.crt -noout -purpose
    function( next ) {
      self.logger.debug( 'Check an actual certificate is provided' );
      openssl.exec( 'x509', {
        in:      path.join( os.tmpdir(), tmp ),
        noout:   true,
        purpose: true
      }, function( err, res ) {
        if( err ) {
          self.logger.error( 'Invalid client certificate' );
          return next({
            error: true,
            desc:  'INVALID_CLIENT_CERTIFICATE'
          });
        }
        if( res.toString().indexOf( 'SSL client : Yes' ) === - 1 ) {
          self.logger.error( 'Invalid client certificate' );
          return next({
            error: true,
            desc:  'INVALID_CLIENT_CERTIFICATE'
          });
        }
        next( null );
      });
    },
    // Check if CA sign the certificate
    // openssl verify -CAfile customCA.crt client.crt
    function( next ) {
      var check;
      var cmd = 'openssl verify -CAfile ' + self.config.ca + ' ';

      self.logger.debug( 'Check certificate is signed by the used CA' );
      check = execSync( cmd + path.join( os.tmpdir(), tmp ) );
      if( check.toString().indexOf( 'OK' ) === - 1 ) {
        self.logger.error( 'Unsigned client certificate' );
        return next({
          error: true,
          desc:  'UNSIGNED_CLIENT_CERTIFICATE'
        });
      }
      next( null );
    },
    // Check certificate dates
    // openssl x509 -in client.crt -noout -dates
    function( next ) {
      self.logger.debug( 'Check certificate dates' );
      openssl.exec( 'x509', {
        in:    path.join( os.tmpdir(), tmp ),
        noout: true,
        dates: true
      }, function( err, res ) {
        if( err ) {
          self.logger.error( 'Invalid client certificate' );
          return next({
            error: true,
            desc:  'INVALID_CLIENT_CERTIFICATE'
          });
        }

        // Extract dates
        _.each( res.toString().trim().split( '\n' ), function( v ) {
          dates.push( v.split( '=' )[ 1 ] );
        });

        // Start date is on the future
        if( new Date( dates[ 0 ] ) > new Date() ) {
          self.logger.error( 'Future client certificate' );
          return next({
            error: true,
            desc:  'FUTURE_CLIENT_CERTIFICATE'
          });
        }

        // Expiration date is on the past
        if( new Date( dates[ 1 ] ) < new Date() ) {
          self.logger.error( 'Expired client certificate' );
          return next({
            error: true,
            desc:  'EXPIRED_CLIENT_CERTIFICATE'
          });
        }

        next( null );
      });
    }
  ], function( err ) {
    fs.unlink( path.join( os.tmpdir(), tmp ) );
    if( err ) {
      return cb( err );
    }
    self.logger.debug( 'Valid client certificate' );
    return cb( null );
  });
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
      method: 'GET',
      path:   '/ping',
      config: {
        security: true
      },
      handler: function( request, reply ) {
        var cert = request.headers[ 'x-buda-client' ] || '';

        self._validateClientCert( cert, function( e ) {
          if( e ) {
            return reply( e );
          }
          self.logger.info( 'Request: Healt check' );
          self.logger.debug({
            params:  request.params,
            headers: request.headers
          }, 'Request details' );
          reply( 'pong' );
        });
      }
    },
    {
      method: 'GET',
      path:   '/',
      config: {
        security: true
      },
      handler: function( request, reply ) {
        var cert = request.headers[ 'x-buda-client' ] || '';

        self._validateClientCert( cert, function( e ) {
          if( e ) {
            return reply( e );
          }
          self.logger.info( 'Request: Retrieve dataset list' );
          self.logger.debug({
            params:  request.params,
            headers: request.headers
          }, 'Request details' );
          self._getDatasetList( function( res ) {
            reply( res );
          });
        });
      }
    },
    {
      method: 'GET',
      path:   '/{id}',
      config: {
        security: true
      },
      handler: function( request, reply ) {
        var cert = request.headers[ 'x-buda-client' ] || '';

        self._validateClientCert( cert, function( e ) {
          if( e ) {
            return reply( e );
          }
          self.logger.info( 'Request: Retrieve dataset details' );
          self.logger.debug({
            params:  request.params,
            headers: request.headers
          }, 'Request details' );
          self._getDatasetDetails( request.params.id, function( res ) {
            reply( res );
          });
        });
      }
    },
    {
      method: 'PUT',
      path:   '/{id}',
      config: {
        security: true
      },
      handler: function( request, reply ) {
        var cert = request.headers[ 'x-buda-client' ] || '';

        self._validateClientCert( cert, function( e ) {
          if( e ) {
            return reply( e );
          }
          self.logger.info( 'Request: Update dataset' );
          self.logger.debug({
            params:  request.params,
            headers: request.headers
          }, 'Request details' );

          // Parse dataset declaration if using YAML format
          if( request.payload.format && request.payload.format === 'yaml' ) {
            request.payload.dataset = YAML.parse( request.payload.dataset );
          }

          self._updateDataset( request.params.id, request.payload.dataset, function( r ) {
            reply( r );
          });
        });
      }
    },
    {
      method: 'PATCH',
      path:   '/{id}',
      config: {
        security: true
      },
      handler: function( request, reply ) {
        var cert = request.headers[ 'x-buda-client' ] || '';

        self._validateClientCert( cert, function( e ) {
          if( e ) {
            return reply( e );
          }
          self.logger.info( 'Request: Update dataset' );
          self.logger.debug({
            params:  request.params,
            headers: request.headers
          }, 'Request details' );

          // Parse dataset declaration if using YAML format
          if( request.payload.format && request.payload.format === 'yaml' ) {
            request.payload.dataset = YAML.parse( request.payload.dataset );
          }

          self._updateDataset( request.params.id, request.payload.dataset, function( r ) {
            reply( r );
          });
        });
      }
    },
    {
      method: 'DELETE',
      path:   '/{id}',
      config: {
        security: true
      },
      handler: function( request, reply ) {
        var cert = request.headers[ 'x-buda-client' ] || '';

        self._validateClientCert( cert, function( e ) {
          if( e ) {
            return reply( e );
          }
          self.logger.info( 'Request: Delete dataset' );
          self.logger.debug({
            params:  request.params,
            headers: request.headers
          }, 'Request details' );
          self._deleteDataset( request.params.id, function( res ) {
            reply( res );
          });
        });
      }
    },
    {
      method: 'POST',
      path:   '/',
      config: {
        security: true
      },
      handler: function( request, reply ) {
        var cert = request.headers[ 'x-buda-client' ] || '';

        self._validateClientCert( cert, function( e ) {
          if( e ) {
            return reply( e );
          }
          self.logger.info( 'Request: Create dataset' );
          self.logger.debug({
            params:  request.params,
            headers: request.headers
          }, 'Request details' );

          // Parse dataset declaration if using YAML format
          if( request.payload.format && request.payload.format === 'yaml' ) {
            request.payload.dataset = YAML.parse( request.payload.dataset );
          }

          self._registerDataset( request.payload.dataset, function( res ) {
            reply( res );
          });
        });
      }
    },
    {
      method: '*',
      path:   '/{p*}',
      config: {
        security: true
      },
      handler: function( request, reply ) {
        var cert = request.headers[ 'x-buda-client' ] || '';

        self._validateClientCert( cert, function( e ) {
          if( e ) {
            return reply( e );
          }
          self.logger.warn( 'Bad request: %s %s', request.method, request.path );
          self.logger.debug({
            params:  request.params,
            headers: request.headers
          }, 'Request details' );
          reply({
            error: true,
            desc:  'INVALID_REQUEST'
          });
        });
      }
    }
  ] );

  // Open connections
  this.restapi.start( function( err ) {
    if( err ) {
      self.logger.fatal( err );
      self.emit( 'error', err );
    }
  });
};

// Starts a new dataset agent
BudaManager.prototype._startAgent = function( dataset ) {
  var self = this;
  var agent;

  // Use manager storage as the agent's if no host is specified
  if( ! _.has( dataset.data.storage, 'host' ) ) {
    dataset.data.storage.host = this.config.storage;
  }

  if( self.config.docker ) {
    // Start agent as a container if running in 'docker' mode
    agent = _startContainer( dataset );
    self.logger.info( 'Starting container agent: %s', agent );
    self.logger.debug({
      configuration: dataset.data
    }, 'Starting container agent: %s', agent );
    self.agents[ dataset.extras.id ] = agent;
  } else {
    // Star agent as subprocess
    agent = _startSubProcess( dataset, self.config );
    self.logger.info( 'Starting subprocess agent: %s', agent.pid );
    self.logger.debug({
      configuration: dataset.data
    }, 'Starting agent: %s', agent.pid );
    self.agents[ dataset.extras.id ] = agent.pid;
  }

  if( agent.stdout ) {
    agent.stdout.pipe( process.stdout );
  }
};

// Stops a given dataset agent
BudaManager.prototype._stopAgent = function( dataset ) {
  var self = this;

  // Kill agent
  if( self.config.docker ) {
    self.logger.debug( 'Stopping container agent: %s', dataset.data.storage.collection );
    try {
      execSync( 'docker rm -f ' + dataset.data.storage.collection );
    } catch ( err ) {
      self.logger.debug( 'Failed stopping agent: %s', dataset.data.storage.collection );
    }
  } else {
    self.logger.debug( 'Stopping process agent: %s', self.agents[ dataset.extras.id ] );
    try {
      process.kill( self.agents[ dataset.extras.id ], 'SIGTERM' );
    } catch( e ) {
      self.logger.error( e );
    }
  }
};

// Retrive a list of all datasets
BudaManager.prototype._getDatasetList = function( cb ) {
  var self = this;

  DatasetModel.find({}, { _id: 0 }, function( err, res ) {
    if( err ) {
      self.logger.error( err );
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }
    cb( res );
  });
};

// Retrieve details of a specific dataset
BudaManager.prototype._getDatasetDetails = function( id, cb ) {
  var self = this;

  // Retrieve element based on it's id
  DatasetModel.find({ 'extras.id': id }, { _id: 0 }, function( err, res ) {
    if( err ) {
      self.logger.error( err );
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }

    if( res.length !== 1 ) {
      self.logger.warn( 'Invalid dataset id: %s', id );
      return cb({ error: true, desc: 'INVALID_ZONE_ID' });
    }

    return cb( res[ 0 ] );
  });
};

// Update and existing dataset
BudaManager.prototype._updateDataset = function( id, newData, cb ) {
  var self = this;

  // Delete existing dataset
  self._deleteDataset( id, function( res ) {
    if( res.error ) {
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }

    // Create new dataset
    self._registerDataset( newData, function( dataset ) {
      if( dataset.error ) {
        return cb({ error: true, desc: 'INTERNAL_ERROR' });
      }
      cb( dataset );
    });
  });
};

// Delete an existing dataset
BudaManager.prototype._deleteDataset = function( id, cb ) {
  var self = this;

  DatasetModel.where({ 'extras.id': id }).findOneAndRemove( function( err, res ) {
    // Delete error
    if( err ) {
      self.logger.error( err );
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }

    // Invalid ID
    if( ! res ) {
      self.logger.warn( 'Invalid dataset id: %s', id );
      return cb({ error: true, desc: 'INVALID_ZONE_ID' });
    }

    // Stop dataset agent and return
    self._stopAgent( res._doc );
    return cb( res._doc );
  });
};

// Register a new dataset
BudaManager.prototype._registerDataset = function( dataset, cb ) {
  // Validation function holder
  var validation;
  var self = this;

  // Check dataset details are present
  if( ! dataset ) {
    this.logger.warn( 'Missing parameters' );
    return cb({ error: true, desc: 'MISSING_PARAMETERS' });
  }

  // Not supported schema version?
  if( ! this.schemas[ 'dataset-' + dataset.version ] ) {
    this.logger.error( 'Unsupported schema version' );
    return cb({ error: true, desc: 'UNSUPPORTED_SCHEMA_VERSION' });
  }

  // Validate dataset against the schema version used
  validation = jsen( JSON.parse( this.schemas[ 'dataset-' + dataset.version ] ) );
  if( ! validation( dataset ) ) {
    this.logger.error({ errors: validation.errors }, 'Invalid dataset definition' );
    return cb({
      error:   true,
      desc:    'INVALID_DATASET_DEFINITION',
      details: validation.errors
    });
  }

  // Set dates
  dataset.metadata.issued = new Date( dataset.metadata.issued || Date.now() );
  dataset.metadata.modified = new Date( dataset.metadata.modified || Date.now() );

  // Calculate ID
  dataset.extras.id = _getID( dataset );

  // Start dataset agent
  this._startAgent( dataset );

  // Store dataset record
  DatasetModel.collection.insert( dataset, function( err ) {
    if( err ) {
      self.logger.error( err );
      return cb({ error: true, desc: 'INTERNAL_ERROR' });
    }

    delete dataset._id;
    cb( dataset );
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

  // Get existing datasets
  self._getDatasetList( function( list ) {
    // Close storage connection
    mongoose.connection.close( function() {
      // Stop running agents
      self.logger.info( 'Storage disconnected' );
      self.logger.info( 'Stopping running agents' );
      if( list.length > 0 ) {
        _.each( list, function( dataset ) {
          self._stopAgent( dataset._doc );
        });
      }
      self.logger.info( 'Exiting Manager' );
      self.emit( 'exit' );
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
    self.emit( 'exit' );
  }

  // Log config
  self.logger.info( 'Buda Manager ver. ' + info.version );
  self.logger.debug({
    config: self.config
  }, 'Starting with configuration' );

  // Storage connection
  DatasetStorageSchema.set( 'strict', false );
  DatasetStorageSchema.set( 'collection', 'sys.datasets' );
  DatasetModel = mongoose.model( 'Doc', DatasetStorageSchema );
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
    self.emit( 'error', err );
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

  // CA validations
  if( self.config.ca ) {
    self.logger.info( 'Verifying CA for secure mode' );
    self._validateCA();
  }

  // Move process to working directory
  self.logger.info( 'Moving process to working directory' );
  process.chdir( self.config.home );

  // Re-start agents from any existing datasets
  self.logger.info( 'Restarting existing agents' );
  self._getDatasetList( function( list ) {
    _.each( list, function( dataset ) {
      self.logger.info( 'Starting agent for dataset: ' + dataset._doc.extras.id );
      self._stopAgent( dataset._doc );
      self._startAgent( dataset._doc );
    });
  });

  // Start REST interface
  self.logger.info( 'Starting REST interface' );
  self._startInterface();
  self.logger.debug({
    config: self.restapi.info
  }, 'Interface started with configuration' );

  // Log final output
  self.logger.info( 'Initialization process complete' );
  if( self.config.ca ) {
    self.logger.info( 'Running in SECURE mode' );
  }

  // Listen for interruptions and gracefully shutdown
  process.stdin.resume();
  process.on( 'SIGINT', _.bind( this.exit, this ) );
  process.on( 'SIGTERM', _.bind( this.exit, this ) );
};

module.exports = BudaManager;
