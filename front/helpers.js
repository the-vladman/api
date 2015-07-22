// Enable strict syntax mode
'use strict';

// Dependencies
/* eslint no-sync:0 */
var execSync = require( 'child_process' ).execSync;

// Collection of helper functions used through the application
module.exports = {
  // Encode a given buffer or string to base64
  base64Enc: function( data ) {
    return new Buffer( data ).toString( 'base64' );
  },

  // Decode a given buffer or string from base64, defaults to ascii
  base64Dec: function( data, format ) {
    return new Buffer( data, 'base64' ).toString( format || 'ascii' );
  },

  // Calculate the fingerprint of a given RSA key, either the private or
  // public half
  rsaFingerprint: function( data, pubin ) {
    var cmd;

    if( pubin ) {
      cmd = 'echo "' + data + '" | openssl rsa -pubin -noout -modulus';
    } else {
      cmd = 'echo "' + data + '" | openssl rsa -noout -modulus';
    }
    return execSync( cmd + ' | openssl sha1 -c' ).toString().toUpperCase().trim();
  }
};
