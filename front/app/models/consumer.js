// Dependencies
var mongoose = require( 'mongoose' );
var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;

// API Consumer data model
/* eslint no-reserved-keys:0 */
var ConsumerSchema = new Schema({
  uuid:       { type: String, unique: true, required: true },
  details:    { type: Mixed, default: {} },
  apiKey:     { type: ObjectId, ref: 'RSAKey' },
  accessKeys: [{ type: ObjectId, ref: 'RSAKey' }]
}, {
  strict:     true,
  read:       'nearest',
  versionKey: '_v',
  collection: 'sys.consumers',
  safe:       { j: 1, w: 'majority' }
});

// Model export
mongoose.model( 'Consumer', ConsumerSchema );
