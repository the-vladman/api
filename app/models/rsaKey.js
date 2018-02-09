// Enable strict syntax mode
'use strict';

// Dependencies
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// API Consumer data model
var RSAKeySchema = new Schema({
  fingerprint: {
    type: String,
    unique: true,
    required: true
  },
  pub: {
    type: String
  },
  priv: {
    type: String
  }
},
{
  strict: true,
  read: 'nearest',
  versionKey: '_v',
  collection: 'sys.keys',
  safe: {
    j: 1,
    w: 'majority'
  }
});

// Model export
mongoose.model('RSAKey', RSAKeySchema);
