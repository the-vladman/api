// Enable strict syntax mode
'use strict';

// Dependencies
var express = require('express');
var router = new express.Router();

module.exports = function(options) {
  // Load required controller
  var api = require('../controllers/api.v1')(options);

  // Auth routes
  router.post('/auth', api.registerConsumer);
  router.get('/auth/:id', api.getConsumerInfo);
  router.post('/auth/:id/key', api.addConsumerKey);
  router.delete('/auth/:id/key/:keyId', api.delConsumerKey);

  // DCAT metadata
  router.get('/catalog.json', api.catalogInfo);

  // Data CRUD operations
  router.get('/:dataCollection', api.runQuery);
  router.get('/:dataCollection/:docId', api.getDocument);
  router.post('/:dataCollection', api.registerDocument);
  router.put('/:dataCollection/:docId', api.updateDocument);
  router.patch('/:dataCollection/:docId', api.updateDocument);
  router.delete('/:dataCollection/:docId', api.delDocument);

  return router;
};
