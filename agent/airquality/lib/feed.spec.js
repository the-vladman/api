// Enable strict syntax mode
'use strict';

// Measurement definition
var Measurement = function() {
  return {
    pollutant: '',
    unit:      '',
    value:     '',
    time:      ''
  };
};

// Index definition
var Index = function() {
  return {
    scale:                '',
    value:                '',
    responsiblePollutant: '',
    calculationTime:      ''
  };
};

// Station definition
var Station = function() {
  return {
    id:       '',
    name:     '',
    location: {
      lat: '',
      lon: '',
      alt: ''
    },
    measurements: [],
    indexes:      []
  };
};

// Feed entry definition
var FeedEntry = function() {
  return { stations: [ new Station() ] };
};

module.exports.version = 'v0.9';
module.exports.Measurement = Measurement;
module.exports.Index = Index;
module.exports.Station = Station;
module.exports.FeedEntry = FeedEntry;
