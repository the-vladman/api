#BUDA FRONT
-----------

Implementa el punto de acceso a todos los datos procesados y almacenados por BUDA en las distintas zonas disponibles mediante una interfaz HTTP(S) tipo REST.

Las operaciones básicas se realizan mediante verbos HTTP de la siguiente forma:

- __GET__: Realiza una consulta
- __POST__: Captura un registro nuevo
- __PUT__: Actualiza o modifica un registro existente
- __DELETE__: Elimina un registro existente

Las rutas son estructuradas utilizando la colección de datos sobre la que se este trabajando de la siguiente forma:

```
BUDA_FRONT_ACCESS/data.collection/doc.id
```

Donde:

- __BUDA_FRONT_ACCESS__: Protocolo + IP/dominio + puerto donde el proceso front esta e scuchando por peticiones
- __data.collection__: Colección de datos sobre la cual se esté trabajando
- __doc.id__: ID del documento específico sobre el cual se esté trabajando, en caso de ser relevante para la operación en cuestión

Un ejemplo de una ruta con todos sus componentes:

```
https://buda.mxabierto.org:9001/carto.veracruz.calles/544ef78ba5b815b79673d885
```

Otras consideraciones importantes:

- Todas las operaciones devuelven JSON
- Todas las operaciones que esperan datos ( PUT y POST ) los esperan en JSON
- Todas las fechas seran devueltas en __UTC__ y utilizando el formato __ISO 8601__
- Todas las operaciones esperan y devuelven datos en UTF8 mediante los encabezados adecuados: __Content-Type: application/json; charset=utf-8__
- Todas las operaciones deberán ser debidamente validadas; para mas información consultar el apartado _'SEGURIDAD'_; la única excepción serán las consultas ( operaciones GET ) a colecciones de datos marcadas como _públicas_

## Respuestas
Todas las operaciones de creación/edición de contenido, y las operaciones de consumo que duelven un solo elemento, responden para operaciones exitosas el recurso sobre el cual se realizo la operación.

```
{
  "_id" : "53fa1ebc0f18039f2d8c4634",
  "_v" : 0,
  "email" : "info@mxabierto.org",
  "name" : "Dirección General de Asuntos Sin Importancia"
  "address" : {
    "street" : "Av. Xalapa",
    "extNum" : "310",
    "intNum" : "",
    "zone" : "Unidad del Bosque",
    "postalCode" : "00121",
    "city" : "Xalapa",
    "state" : "Veracruz",
    "country" : "México"
  }
}
```

En el caso de operaciones de cosumo que devuelven multiples elementos la respuesta incluye el listado de resultados e información sobre la paginación.

```
{
  "results": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 133
  }
}
```

## Manejo de Errores
Todas las operaciones que se determinan en alguna condición de error regresan una estructura JSON que describe la condición y __opcionalmente__ algunos detalles adicionales:

```
{
  "error": "INVALID_DOCUMENT_ID",
  "details": {...}
}
```

- Existen 2 tipos principales de error; aquellos que se ocasionan del lado __del cliente__ y aquellos que surgen del lado __del servicio__.
- La distinción entre ambos tipos de error se determinan por el __encabezado HTTP de estatus__ devuelto por el servicio
- Los errores del lado del cliente devuelven un encabezado __4xx__ y deberán ser corregidos en la implementación del cliente.
- Los errores del lado del servicio devuelven un encabezado __5xx__ y deberán ser reportados como una incidencia a revisión.

## Operaciones
### GET
Las consultas deberán ser realizadas contra el recurso de la colección de datos sobre la que se este trabajando y las condiciones ser expresadas como parte de la __cadena de consulta__ [Query String*](https://en.wikipedia.org/wiki/Query_string).

Para expresar condiciones mas complejas que la igualdad absoluta se podran utilizar los siguientes operadores:

```
* Igualdad
key=val

* Comparasión
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
key=[within:COLLECTION.DOC_ID]
key=[intersects:COLLECTION.DOC_ID]
key=[near:lat,long]

* Lógico
$or=[cond|cond]
$and=[cond|cond]
$nor=[cond|cond]
$not=[cond|cond]
```

### POST
- La ruta especifica solo la colección de datos a utilizar para almacenar el documento enviado.
- Los datos para almacenamiento se envian en el _Request Body_.
- La respuesta es el documento completo tal como fue registrado por el servicio.

### PUT
- La ruta especifica la colección de datos a utilizar y el ID del documento que será actualizado.
- Los datos para actualización se envian en el _Request Body_.
- La respuesta es el documento completo tal como fue actualizado por el servicio.

### DELETE
- La ruta especifica la colección de datos a utilizar y el ID del documento que será eliminado.
- La respuesta es el documento completo que fue eliminado por el servicio.

## Seguridad
Todos los datos manejados por el proceso deberán operarse de forma segura, para ello un esquema de validación y autenticación basado en llaves asimétricas (__handshake__) se establece de la siguiente forma:

- Todas las entidades que operarán el API se deben registrar como un __Consumer__, estas entidades pueden ser: usuarios, bots, aplicaciones, instituciones, etc.
- Al ser registrado, el servicio genera un identificador único para cada _consumer_ (__Consumer ID__) y una llave RSA (__API Key__), tanto el ID como la parte pública del API Key son devueltas al consumer tras un registro exitoso y deberán ser utilizadas en un futuro para realizar operaciones en el sistema.
- Antes de poder comenzar a realizar operaciones el consumer deberá asociar al menos una llave de acceso (__Consumer Key__) a su cuenta; en esta operación el consumer generá su propia llave RSA y envia al servicio la parte pública.

Algunos aspectos importantes a destacar de este proceso:

- Tanto el usuario como el servicio generán de forma autónoma, secreta y (potencialmente) segura sus propias llaves RSA.
- El intercambio se realiza con la parte pública de ambas partes asi que las llaves privadas no necesitan ser enviadas por la red en ningún momento.

Al finalizar el proceso las llaves privadas seran utilizadas en  cada endpoint para generar firmas electronicas de la información intercambiada y las llaves públicas para validar dichas firmas apropiadamente.

### Consumer ID
El identificador único por cada consumer se trata de un Identificador Único Universal versión 4 [(UUID)](https://tools.ietf.org/html/rfc4122)

```
A88B4C38-14B9-4AD2-9517-770A63D3A5C3
```

### Consumer y API Key
Tanto el Consumer Key como el API Key serán llaves RSA de al menos 1024 bits, la parte pública es enviada a la contraparte en codificación base64.

```
LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlHZk1BMEdDU3FHU0liM0RRRUJB
UVVBQTRHTkFEQ0JpUUtCZ1FEWFpoL0M1a1FjSnk1eExhZTluNC8vRGFvbQoxd3VI
dVlBVGgzdHFlUWk0VGJiMXJGWEFSY2g0aExFSkoxaFBIR04zS3VKK1lTRXJJL0kw
ckZpaXdzaDlXN1lJClBMdlpPZzVwaUpFQlpUK2o3NVVvdHBqemRtSGxLWmlyVmE4
VzJ5aktUcm91RFMwenlUcnRqbUw0cmxRVDRuM0kKSml1ZC9qZlJtQVRXUGNOYVR3
SURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo=
```

### Request Signature
Todas las peticiones deberan ser firmadas digitalmente para validar la autenticidad, integridad y origen de la información de forma bidireccional: información del usuario hacia el servico y del servicio hacia el usuario.

La firma de las peticiones se calcula de la siguiente forma:

- Se obtiene un hash SHA1 de la información a ser intercambiada; son los datos de entrada o salida excepto en las peticiones de consulta (GET), en ese caso la información enviada por el usuario es la __cadena de consulta__; los primeros 10 caractéres del hash se utilizaran como __código de referencia__.

Calcular código de referencia:

```
echo -n "json codificado" | openssl sha1 | cut -c1-10
```

- Utilizando el código de referencia se genera una firma electrónica utilizando la llave privada, esta firma sera enviada a la contraparte codificada en __base64__.

Generación de una firma utilizando la llave privada:

```
echo -n "2702eff870" | openssl rsautl -sign -inkey priv | base64
```

- La contraparte validará la firma recalculando el hash y verificandola con la llave pública correspondiente.

Validación de una firma utilizando la llave pública:

```
base64 -D signature | openssl rsautl -verify -pubin -inkey pub
```

### Headers

Todas las operaciones deben ser autenticadas utilizando encabezados HTTP con los siguientes valores:

- __BUDA-Consumer-ID__: UUID del Consumer
- __BUDA-Consumer-Key__: Fingerprint de la llave del consumer utilizada para el intercambio de información
- __BUDA-Request-Signature__: Firma del mensaje


En el caso del header __BUDA-Consumer-Key__ deberá incluir el fingerprint de la llave utilizada, separado por bloques y en mayúsculas; por ejemplo:

```
B2:FD:48:9A:0F:FC:12:9B:72:F4:83:86:BD:C2:09:73
```

Este valor se puede obtener a partir de la parte privada o pública de una llave:

```
openssl rsa -in priv -noout -modulus | openssl md5 -c | tr "[:lower:]" "[:upper:]"
openssl rsa -in pub -pubin -noout -modulus | openssl md5 -c | tr "[:lower:]" "[:upper:]"
```
