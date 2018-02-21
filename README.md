# BUDA FRONT

Implementa el punto de acceso a todos los datos procesados y almacenados por BUDA en las distintas zonas disponibles mediante una interfaz HTTP(S) tipo REST.

Las operaciones básicas se realizan mediante verbos HTTP de la siguiente forma:

- __GET__: Realiza una consulta

Las rutas son estructuradas utilizando la colección de datos sobre la que se este trabajando de la siguiente forma:

```
API_VERSION/data.collection/doc.id
```

Donde:

- __data.collection__: Colección de datos sobre la cual se esté trabajando
- __doc.id__: ID del documento específico sobre el cual se esté trabajando, en caso de ser relevante para la operación en cuestión

Un ejemplo de una ruta con todos sus componentes:

```
https://api.datos.gob.mx/v1/carto.veracruz.calles/544ef78ba5b815b79673d885
```

Otras consideraciones importantes:

- Todas las operaciones devuelven JSON
- Todas las fechas seran devueltas en __UTC__ y utilizando el formato __ISO 8601__
- Todas las operaciones esperan y devuelven datos en UTF8 mediante los encabezados adecuados: __Content-Type: application/json; charset=utf-8__

## Respuestas
Todas las operaciones de consumo la respuesta incluye el listado de resultados e información sobre la paginación.

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

## Operaciones
### GET
Las consultas deberán ser realizadas contra el recurso de la colección de datos sobre la que se este trabajando y las condiciones ser expresadas como parte de la __cadena de consulta__ [Query String*](https://en.wikipedia.org/wiki/Query_string).

Para expresar condiciones mas complejas que la igualdad absoluta, se pueden utilizar los siguientes operadores:

```
* Igualdad
key=val

* Comparación
key=[gt:x]
key=[gte:x]
key=[lt:x]
key=[lte:x]
key=[in:s,e,t]
key=[nin:s,e,t]
key=[range:min|max]

* Evaluación
key=[regex:'/PATTERN/']
key=[text:'needle...']

* GeoEspacial
key=[within:COLLECTION,DOC_ID]
key=[intersects:COLLECTION,DOC_ID]
key=[near:long,lat]

* Lógico
$or=[cond|cond]
$and=[cond|cond]
$nor=[cond|cond]
$not=[cond|cond]
```
