
import { success, notFound } from '../../services/response/'
import { makeObject } from '../../services/dataCollection/'
import mongoose from 'mongoose'
import aqp from 'api-query-params'


export const queries = (req, res, next) => {
  const max_page_size = 100
  const DataObject = makeObject(req.params.dataCollection)
  const query = aqp(req.query)
  if (query.filter.pageSize) {
    query.limit = query.filter.pageSize
    delete query.filter.pageSize
  }else{
    query.limit = max_page_size
  }
  if (query.filter.page) {
    var aux = parseInt(query.filter.page)

    if(aux > 0){
      --aux
    }else{
      aux = 1
    }
    query.skip = aux * query.limit
    delete query.filter.page
  }
  DataObject.count(query.filter)
    .then(total =>
      DataObject
      .find(query.filter)
      .skip(query.skip)
      .limit(query.limit)
      .sort(query.sort)
      .select(query.projection)
      .then((DataObjects) => ({
        pagination:{
          pageSize: query.limit,
          page: parseInt((query.skip || 0) / query.limit) + 1,
          total
        },
        results: DataObjects.map((DataObject) => DataObject)
      }))
    )
    .then(success(res))
    .catch(next)
}

export const index = ({ querymen: { query, select, cursor } }, res, next) =>
  res.status(200).json([])
