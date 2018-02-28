import Promise from 'bluebird'
import mongoose from 'mongoose'

const DataObjectSchema = new mongoose.Schema({}, {
  strict: false,
  read: 'nearest',
  versionKey: '_v',
  safe: {
    j: 1,
    w: 'majority'
  }
})

export const makeObject = (collection) => {
  const DataObject = mongoose.model('DataObject', DataObjectSchema, collection)
  return DataObject
}
