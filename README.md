# API v2

Implementa el punto de acceso a todos los datos procesados y almacenados por datos.gob.mx en las distintas zonas disponibles mediante una interfaz HTTP(S) tipo REST.

Las rutas son estructuradas utilizando la colección de datos sobre la que se este trabajando de la siguiente forma:

```
API/API_VERSION/data.collection
```

Donde:

- __API__: Protocolo + IP/dominio + puerto donde el proceso front esta escuchando por peticiones
- __API_VERSION__: Versión del API que se desea usar
- __data.collection__: Colección de datos sobre la cual se esté trabajando

Un ejemplo de una ruta con todos sus componentes:

```
https://api.datos.gob.mx/v2/sinaica
```

Otras consideraciones importantes:

- Todas las operaciones devuelven JSON
- Todas las operaciones que esperan datos ( PUT y POST ) los esperan en JSON
- Todas las fechas seran devueltas en __UTC__ y utilizando el formato __ISO 8601__
- Todas las operaciones esperan y devuelven datos en UTF8 mediante los encabezados adecuados: __Content-Type: application/json; charset=utf-8__
- Todas las operaciones deberán ser debidamente validadas. Para mas información consultar el apartado _'SEGURIDAD'_; la única excepción serán las consultas ( operaciones GET ) a colecciones de datos marcadas como _públicas_

## Respuestas

En el caso de operaciones de consumo la respuesta incluye el listado de resultados e información sobre la paginación.

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 133
  },
  "results": []
}
```

## Manejo de Errores
Todas las operaciones que se determinan en alguna condición de error regresan una estructura JSON que describe la condición y __opcionalmente__ algunos detalles adicionales:

```json
{
  "error": "INVALID_DOCUMENT_ID",
  "details": {}
}
```

- Existen 2 tipos principales de error; aquellos que se ocasionan del lado __del cliente__ y aquellos que surgen del lado __del servicio__.
- La distinción entre ambos tipos de error se determinan por el __encabezado HTTP de estatus__ devuelto por el servicio
- Los errores del lado del cliente devuelven un encabezado __4xx__ y deberán ser corregidos en la implementación del cliente.
- Los errores del lado del servicio devuelven un encabezado __5xx__ y deberán ser reportados como una incidencia a revisión.


## Tipo de variables
Cuando una llamada se hace al API, este por defecto castea automaticamente los siguientes tipos de valores:
* Numero
* Expresión regular
* Fecha
* Booleano
* Texto vacio

Si deseas omitir este casteo automatico para poder hacer una igualdad con un número en formato string puedes usar una de las siguientes funciones:
* string(2890)
* date(2017-10-01)

``/v2/(_data.collection_)?key1=string(10)&key2=date(2017-10-01)``

## Operaciones
### GET
Las consultas deberán ser realizadas contra el recurso de la colección de datos sobre la que se este trabajando y las condiciones ser expresadas como parte de la __cadena de consulta__ [Query String*](https://en.wikipedia.org/wiki/Query_string).

Para expresar condiciones mas complejas que la igualdad absoluta, se pueden utilizar los siguientes operadores:


#### Filtros

| MongoDB | URI | Ejemplo | Resultado |
| ------- | --- | ------- | ------ |
| `$eq` | `key=val` | `type=public` | `{filter: {type: 'public'}}` |
| `$gt` | `key>val` | `count>5` | `{filter: {count: {$gt: 5}}}` |
| `$gte` | `key>=val` | `rating>=9.5` | `{filter: {rating: {$gte: 9.5}}}` |
| `$lt` | `key<val` | `createdAt<2016-01-01` | `{filter: {createdAt: {$lt: Fri Jan 01 2016 01:00:00 GMT+0100 (CET)}}}` |
| `$lte` | `key<=val` | `score<=-5` | `{filter: {score: {$lte: -5}}}` |
| `$ne` | `key!=val` | `status!=success` | `{filter: {status: {$ne: 'success'}}}` |
| `$in` | `key=val1,val2` | `country=GB,US` | `{filter: {country: {$in: ['GB', 'US']}}}` |
| `$nin` | `key!=val1,val2` | `lang!=fr,en` | `{filter: {lang: {$nin: ['fr', 'en']}}}` |
| `$exists` | `key` | `phone` | `{filter: {phone: {$exists: true}}}` |
| `$exists` | `!key` | `!email` | `{filter: {email: {$exists: false}}}` |
| `$regex` | `key=/value/<opts>` | `email=/@gmail\.com$/i` | `{filter: {email: /@gmail.com$/i}}` |
| `$regex` | `key!=/value/<opts>` | `phone!=/^06/` | `{filter: {phone: { $not: /^06/}}}` |

##### Ejemplo
1. `/v2/(_data.collection_)?date-insert>2018-01-01&pagesize=50&sort=-date-insert`
2. `/v2/(_data.collection_)?parametro=PM10&estacionesid=300&date-insert>=2018-02-18&date-insert<=2018-02-19&pagezise=50`
3. `/v2/(_data.collection_)?filter={"$or":[{"key1":"value1"},{"key2":"value2"}]}`

###### Limitar campos devueltos
* Solo devolver id y url: `/v2/(_data.collection_)?fields=id,url`
* Devolver todo menos id y url: `/v2/(_data.collection_)?fields=-id,-url`

#### Paginación
- pageSize: Indica el la cantidad de los registros devueltos. Por Default el número es `100`.
- page: Indica el indice de los registros devueltos. Por Default el número es `1`.


#### Orden

- Útil para ordenar los registros devueltos
- La clave de operador predeterminada es `sort`
- Acepta una lista de campos separados por comas
- El comportamiento predeterminado es clasificar en orden ascendentecual
- Use los prefijos `-` para ordenar en orden descendente

###### Ejemplo
`/v2/(_data.collection_)?sort=-points,createdAt`
