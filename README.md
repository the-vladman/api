#BUDA
-----

Bus de datos abiertos

### Arquitectura

__Master:__ buda

Ejecutable binario que manipula proceso(s) manager; se comunica con el manager
mediante su interfaz tipo REST

__Manager:__ buda-manager

Proceso que se ejecuta en modo daemon y se encarga de administrar zonas/agentes;
conserva en todo momento una lista de las zonas activas y sus respectivos
agentes; todos los agentes son subprocesos del manager que los creo

__Zones:__ csv_sample.zone

Puntos destinados a la recepción de datos; se describen mediante un archivo
de especifición (JSON); estos archivos son utilizados por el manager para
crear agentes; un agente es asignado a cada zona; cada zona es asignada
un ID que se calcula a partir del SHA del archivo utilizado para crearla

__Agents:__ buda-agent-{data.type}

Proceso tipo de worker, se inicia por el manager y ejecuta en modo daemon;
abre un stream de lectura en el "hotspot" marcado por su zona y espera por datos
de entrada; cada paquete de datos recibido es procesado y almacenado de
acuerdo a las configuraciones de la zona; los agentes son procesos especializados
de acuerdo al tipo de dato que se procesara en la zona; cada zona indica
tambien donde debera reportar errores el agente mediante un stream de escritura

__Front:__ buda-front

Ademas del manager, front es el otro proceso de primer nivel en la plataforma; se
encarga de presentar un API tipo REST mediante HTTP/S al usuario para realizar
consultas de toda la información procesada y almancenada en las distintas zonas

### Consideraciones

- Cada componente de la arquitectura es independiente, el mantenimiento del proyecto
  es sencillo y se puede realizar en paralelo en distintos frentes
- Para agregar soporte a distintos tipos de datos ( XML, feeds, etc ) basta con escribir
  un agente adecuado por lo que la plataforma es sumamente extensible
- Implementar esta arquitectura como un ambiente de microservicios es simple porque todas
  las capas estan bien delimitadas, son sencillas e independientes entre sí
- El eje central de la arquitectura es la especificación de zona y esto puede desarrollarse
  y mejorarse con el apoyo de la comunidad :)
- Todos los componentes son procesos livianos y utilizan streams de datos por lo que los
  requerimientos de CPU y memoria son bajos
- Un master puede facilmente comunicarse con distintos managers e iniciar distintos
  fronts por lo que el sistema puede manejarse de forma distribuida
- Los agentes son solo procesos hijos asi que la implementación especifica es un detalle
  irrelevante para el resto de la plataforma; i.e. pueden escribirse agentes en Python,
  Ruby, Go, etc
- En una versión para producción los agentes incluso pueden desplegarse como containers
  en el cluster de forma relativamente sencilla
- Las zonas son solo un archivo JSON por lo que implementar herramientas visuales para
  diseñarlas es trivial
- El manager implementa una interfaz RESTful HTTP para comunicarse con el master por lo que
  implementar herramientas visuales para administrarlos es trivial
- Las zonas incluyen un elemento llamada "hotspot" que no es mas que el endpoint del stream
  utilizado para recibir datos; estos endpoints pueden ser UNIX sockets, TCP sockets o
  algun otro mecanismo mas avanzando ( por ejemplo torrents para implementarse como sistemas
  realmente descentralizados :D )
- En caso de utilizar UNIX sockets se pueden "montar" en la maquina local de forma segura
  utilizando un SSH tunnel; en caso de sockets TCP se pueden implementar de forma segura
  mediante conexiones HTTPS
- Una vez creada la zona se pueden implementar herramientas visuales tipo drag & drop para
  enviar datos de forma sencilla ya que lo único que la herramienta debe hacer es iniciar
  el streaming de paquetes hacia el hotspot de la zona ;)

### Zone spec

Bucket CSV-UNIX-mongo sample:

```
{
  "version: "0.1",
  "metadata": {
    "name": "CSV Sample",
    "description": "Just a sample CSV zone",
    "author": "Ben Cessa",
    "organization": "Mexico Abierto",
    "website": "mxabierto.org",
    "email": "ben@pixative.com",
    "phone": ""
  },
  "data": {
    "type": "csv",
    "details": {
      "separator: ","
    }
  },
  "storage": {
    "type": "mongodb",
    "details": {
      "host": "localhost:27017",
      "database": "prueba"
      "collection": "codigosPostales",
      "index": "d_codigo"
    }
  },
  "errors": {
    "type": "stdout"
  },
  "hotspot": {
    type: "unix",
    location: "cvs-sample.sock"
  },
  "extras": {}
}
```

Bucket GeoJSON-TCP-mongo sample:

```
{
  "version: "0.1",
  "metadata": {
    "name": "GeoJSON Sample",
    "description": "Just a sample GeoJSON zone",
    "author": "Ben Cessa",
    "organization": "Mexico Abierto",
    "website": "mxabierto.org",
    "email": "ben@pixative.com",
    "phone": ""
  },
  "data": {
    "type": "geojson",
    "details": {
      "pointer": "features.*",
      "removeAltitude": true,
      "removeDuplicatePoints": true
    }
  },
  "storage": {
    "type": "mongodb",
    "details": {
      "host": "localhost:27017",
      "database": "prueba"
      "collection": "callesVeracruz"
    }
  },
  "errors": {
    "type": "stdout"
  },
  "hotspot": {
    type: "tcp",
    location: "37001"
  },
  "extras": {}
}
```